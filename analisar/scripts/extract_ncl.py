import pypdf
import sys

def extract_text(input_path, output_path):
    print(f"Extracting text from {input_path}...")
    reader = pypdf.PdfReader(input_path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(text)
    print("Extraction complete!")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 extract_ncl.py <input_pdf> <output_txt>")
        sys.exit(1)
    extract_text(sys.argv[1], sys.argv[2])
