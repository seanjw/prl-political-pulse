import requests
import zipfile

# header file:
url = "https://www.fec.gov/files/bulk-downloads/data_dictionaries/indiv_header_file.csv"
response = requests.get(url)
with open("assets/indiv_header_file.csv", "w") as out_file:
    out_file.write(response.content.decode())


# CCL
# data file:
url = "https://www.fec.gov/files/bulk-downloads/2024/ccl24.zip"
response = requests.get(url)
with open("assets/ccl24.zip", "wb") as out_file:
    out_file.write(response.content)

# # Unzip the file
with zipfile.ZipFile("assets/ccl24.zip", "r") as zip_ref:
    zip_ref.extractall("assets")


# header file:
url = "https://www.fec.gov/files/bulk-downloads/data_dictionaries/ccl_header_file.csv"
response = requests.get(url)
with open("assets/ccl_header_file.csv", "w") as out_file:
    out_file.write(response.content.decode())


# # Download the zip file
# with urllib.request.urlopen(url) as response, open(zip_filename, 'wb') as out_file:
#     print(response)
#     data = response.read()
#     out_file.write(data)
