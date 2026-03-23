import os
import os.path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

# Absolute paths to token and credentials
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RESOURCES_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), 'resources')
TOKEN_PATH = os.path.join(RESOURCES_DIR, 'token.json')
CREDENTIALS_PATH = os.path.join(RESOURCES_DIR, 'credentials.json')

SCOPES = ['https://www.googleapis.com/auth/drive.file']

def get_service():
    creds = None
    if os.path.exists(TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CREDENTIALS_PATH):
                raise FileNotFoundError(f"Credentials not found at {CREDENTIALS_PATH}")
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)
        
        with open(TOKEN_PATH, 'w') as token:
            token.write(creds.to_json())

    try:
        service = build('drive', 'v3', credentials=creds)
        return service
    except HttpError as error:
        print(f'An error occurred: {error}')
        return None

def get_or_create_folder(service, folder_name, parent_id=None):
    query = f"name = '{folder_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    if parent_id:
        query += f" and '{parent_id}' in parents"
    
    results = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
    items = results.get('files', [])

    if items:
        return items[0]['id']
    else:
        file_metadata = {
            'name': folder_name,
            'mimeType': 'application/vnd.google-apps.folder'
        }
        if parent_id:
            file_metadata['parents'] = [parent_id]
        
        folder = service.files().create(body=file_metadata, fields='id').execute()
        return folder.get('id')

def upload_file(local_path, marca, cliente=None):
    """Uploads a file to Google Drive under 'Clientes/[marca] - [cliente]'."""
    print(f"🚀 Iniciando upload para o Google Drive: {os.path.basename(local_path)}")
    service = get_service()
    if not service:
        print("❌ Erro ao conectar com o Google Drive.")
        return

    try:
        # 1. Ensure root 'Clientes' folder
        root_folder_id = get_or_create_folder(service, "Clientes")
        
        # 2. Folder name for the client
        folder_name = marca
        if cliente and cliente.strip():
            folder_name = f"{marca} - {cliente}"
            
        target_folder_id = get_or_create_folder(service, folder_name, parent_id=root_folder_id)

        # 3. Upload file
        file_metadata = {
            'name': os.path.basename(local_path),
            'parents': [target_folder_id]
        }
        media = MediaFileUpload(local_path, resumable=True)
        file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
        
        print(f"✅ Upload concluído! ID: {file.get('id')}")
        return file.get('id')

    except HttpError as error:
        print(f'❌ Erro no upload: {error}')
        return None

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 2:
        upload_file(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
    else:
        print("Usage: python google_drive_service.py <file_path> <marca> [cliente]")
