from docling.datamodel.base_models import InputFormat
from docling.document_converter import DocumentConverter
import sys

def convert_pdf(input_path, output_path):
    print(f"Converting {input_path} to {output_path}...")
    converter = DocumentConverter()
    result = converter.convert(input_path)
    md_content = result.document.export_to_markdown()
    with open(output_path, "w") as f:
        f.write(md_content)
    print("Conversion complete!")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 convert_ncl.py <input_pdf> <output_md>")
        sys.exit(1)
    convert_pdf(sys.argv[1], sys.argv[2])
