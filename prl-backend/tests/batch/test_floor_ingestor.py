"""Tests for the floor speech ingestor."""

import sys
import os
import datetime
import importlib.util
import pytest
from unittest.mock import patch, MagicMock

# Use importlib to load the floor ingestor with a unique module name
# to avoid conflicts with the twitter ingestor (also named "ingestor").
_module_path = os.path.join(
    os.path.dirname(__file__), "..", "..", "elite", "floor", "ingestor.py"
)
_spec = importlib.util.spec_from_file_location("floor_ingestor", _module_path)

# The floor ingestor imports congressionalrecordparser which lives in the
# same directory. Add that directory to sys.path so it can be found.
sys.path.insert(
    0, os.path.join(os.path.dirname(__file__), "..", "..", "elite", "floor")
)

ingestor = importlib.util.module_from_spec(_spec)
sys.modules["floor_ingestor"] = ingestor
_spec.loader.exec_module(ingestor)


class TestIngestorInit:
    def test_init_creates_table(self):
        mock_db = MagicMock()
        mock_table = MagicMock()
        mock_db.create_table.return_value = mock_table

        with patch("floor_ingestor.dataset.connect") as mock_connect:
            mock_connect.return_value.__enter__ = MagicMock(return_value=mock_db)
            mock_connect.return_value.__exit__ = MagicMock(return_value=False)

            ingestor.init("mysql://test:test@localhost/elite")

            mock_db.create_table.assert_called_once_with(
                "floor",
                primary_id="id",
                primary_type=mock_db.types.integer,
                primary_increment=True,
            )
            assert mock_table.create_column.call_count >= 8

    def test_init_creates_all_columns(self):
        """Verify all required columns are created."""
        mock_db = MagicMock()
        mock_table = MagicMock()
        mock_db.create_table.return_value = mock_table

        with patch("floor_ingestor.dataset.connect") as mock_connect:
            mock_connect.return_value.__enter__ = MagicMock(return_value=mock_db)
            mock_connect.return_value.__exit__ = MagicMock(return_value=False)

            ingestor.init("mysql://test:test@localhost/elite")

            # Collect all column names created
            column_names = [
                call[0][0] for call in mock_table.create_column.call_args_list
            ]
            expected_columns = [
                "date",
                "bioguide_id",
                "text",
                "chamber",
                "record_id",
                "file_id",
                "item_id",
                "cr_vol",
                "cr_num",
                "unique_id",
            ]
            for col in expected_columns:
                assert col in column_names, f"Missing column: {col}"


class TestIngestFunction:
    def test_ingest_no_issues(self):
        """API returns empty Issues -- verify no DB writes."""
        mock_db = MagicMock()
        mock_table = MagicMock()
        mock_db.__getitem__ = MagicMock(return_value=mock_table)

        with patch("floor_ingestor.dataset.connect", return_value=mock_db):
            with patch("floor_ingestor.requests.get") as mock_get:
                mock_response = MagicMock()
                mock_response.json.return_value = {"Results": {"Issues": None}}
                mock_response.raise_for_status = MagicMock()
                mock_get.return_value = mock_response

                date = datetime.date(2024, 7, 1)
                ingestor.ingest(
                    date,
                    date,
                    "mysql://test:test@localhost/elite",
                    "mysql://test:test@localhost/elite",
                    "test_key",
                )

                mock_table.insert_many.assert_called_once_with([])

    def test_ingest_api_error(self):
        """500 response raises HTTPError."""
        import requests

        mock_db = MagicMock()
        with patch("floor_ingestor.dataset.connect", return_value=mock_db):
            with patch("floor_ingestor.requests.get") as mock_get:
                mock_response = MagicMock()
                mock_response.raise_for_status.side_effect = (
                    requests.exceptions.HTTPError("500 Server Error")
                )
                mock_get.return_value = mock_response

                date = datetime.date(2024, 7, 1)
                with pytest.raises(requests.exceptions.HTTPError):
                    ingestor.ingest(
                        date,
                        date,
                        "mysql://test:test@localhost/elite",
                        "mysql://test:test@localhost/elite",
                        "test_key",
                    )

    def test_ingest_with_issues(self):
        """API returns Issues with data -- verify items parsed and inserted."""
        mock_db = MagicMock()
        mock_table = MagicMock()
        mock_db.__getitem__ = MagicMock(return_value=mock_table)

        # Build a mock crfile that the parser would return
        mock_crfile = MagicMock()
        mock_crfile.crdoc = {
            "header": {"year": "2024", "month": "July", "day": "1"},
            "content": [
                {
                    "speaker_bioguide": "A000001",
                    "text": "Test speech text from the floor.",
                },
            ],
        }
        mock_crfile.chamber = "Senate"
        mock_crfile.access_path = "CREC-2024-07-01-pt1-PgS1"
        mock_crfile.cr_vol = 170
        mock_crfile.cr_num = 112

        api_response = MagicMock()
        api_response.json.return_value = {
            "Results": {
                "Issues": [
                    {
                        "IssueDate": "2024-07-01",
                        "Links": {
                            "FullRecord": {
                                "PDF": [
                                    {
                                        "Url": "https://www.govinfo.gov/content/pkg/CREC-2024-07-01.pdf",
                                        "Label": "test",
                                    }
                                ],
                            }
                        },
                    }
                ]
            }
        }
        api_response.raise_for_status = MagicMock()

        zip_response = MagicMock()
        zip_response.raise_for_status = MagicMock()
        zip_response.iter_content = MagicMock(return_value=[b"fake zip content"])
        zip_response.__enter__ = MagicMock(return_value=zip_response)
        zip_response.__exit__ = MagicMock(return_value=False)

        with patch("floor_ingestor.dataset.connect", return_value=mock_db):
            with patch("floor_ingestor.requests.get") as mock_get:
                mock_get.side_effect = [api_response, zip_response]
                with patch("floor_ingestor.zipfile.ZipFile"):
                    with patch(
                        "floor_ingestor.congressionalrecordparser.parse",
                        return_value=[mock_crfile],
                    ):
                        date = datetime.date(2024, 7, 1)
                        ingestor.ingest(
                            date,
                            date,
                            "mysql://test:test@localhost/elite",
                            "mysql://test:test@localhost/elite",
                            "test_key",
                        )

                        # Should have inserted records
                        mock_table.insert_many.assert_called_once()
                        inserted = mock_table.insert_many.call_args[0][0]
                        assert len(inserted) == 1
                        assert inserted[0]["bioguide_id"] == "A000001"
                        assert inserted[0]["chamber"] == "Senate"
                        assert inserted[0]["text"] == "Test speech text from the floor."
