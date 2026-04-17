import time
import os
from flask import Flask, render_template, request, jsonify, Response
from jinja2 import ChoiceLoader, FileSystemLoader


from ..service.service_main import (
    service_autocomplete_data,
    service_export_results,
    service_search_totals,
    service_search_histogram,
    service_search,
    ping_db,
)

# ------------------------------------------------------------------------------
# Flask app & static/template dirs
# ------------------------------------------------------------------------------

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))

app = Flask(
    __name__,
    static_url_path="/static",
    static_folder=os.path.join(BASE_DIR, "frontend", "static"),
    template_folder=os.path.join(BASE_DIR, "frontend", "templates"),
)

app.jinja_loader = ChoiceLoader(
    [
        app.jinja_loader,
        FileSystemLoader(app.static_folder),
    ]
)

# ------------------------------------------------------------------------------
# CORS support - allow cross-origin requests
# ------------------------------------------------------------------------------


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = (
        "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token"
    )
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS"
    return response


# ------------------------------------------------------------------------------
# Routes (thin controllers that call services)
# ------------------------------------------------------------------------------


@app.route("/autocomplete_data")
def autocomplete_data():
    started = time.time()
    try:
        payload = service_autocomplete_data()
        payload["duration"] = round(time.time() - started, 4)
        return jsonify(payload)
    except Exception as e:
        return jsonify(
            {"error": "Failed to load autocomplete data", "detail": str(e)}
        ), 500


@app.route("/export", methods=["POST"])
def export_results():
    try:
        result = service_export_results(request.form)

        # service may return a Response (CSV) OR a dict/list OR (dict, status)
        if isinstance(result, Response):
            return result
        if isinstance(result, tuple) and isinstance(result[1], int):
            body, status = result
            return jsonify(body), status
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": "Export failed", "detail": str(e)}), 500


@app.route("/search_totals", methods=["POST"])
def search_totals():
    started = time.perf_counter()
    try:
        result = service_search_totals(request.form)
        if isinstance(result, tuple) and isinstance(result[1], int):
            body, status = result
            return jsonify(body), status
        result["duration"] = round(time.perf_counter() - started, 3)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": "Totals query failed", "detail": str(e)}), 500


@app.route("/search_histogram", methods=["POST"])
def search_histogram_party():
    started = time.perf_counter()
    try:
        payload = service_search_histogram(request.form)
        payload["duration"] = round(time.perf_counter() - started, 2)
        return jsonify(payload)
    except Exception as e:
        return jsonify({"error": "Histogram query failed", "detail": str(e)}), 500


@app.route("/search", methods=["POST"])
def ajax_search():
    started = time.perf_counter()
    try:
        result = service_search(request.form)
        result["duration"] = round(time.perf_counter() - started, 2)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": "Search failed", "detail": str(e)}), 500


@app.route("/warmup")
def warmup_server():
    started = time.time()
    try:
        ping_db()
        return jsonify({"status": "ok", "elapsed": time.time() - started})
    except Exception as error:
        return jsonify(
            {"status": "error", "detail": str(error), "elapsed": time.time() - started}
        ), 500


@app.route("/")
def index():
    return render_template("index.html")


if __name__ == "__main__":
    app.run(debug=True, port=8000)
