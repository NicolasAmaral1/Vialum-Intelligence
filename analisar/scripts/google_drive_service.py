import os
import os.path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

# Scopes required to manage files and folders
SCOPES = ['https://www.googleapis.com/auth/drive.file']

def escape_drive_query(value):
    """Escapes single quotes for Google Drive API query strings."""
    if not value:
        return value
    return value.replace("'", "\\'")

def get_service():
    """Gets the Google Drive service."""
    creds = None
    # The file token.json stores the user's access and refresh tokens
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        # Save the credentials for the next run
        with open('token.json', 'w') as token:
            token.write(creds.to_json())

    try:
        service = build('drive', 'v3', credentials=creds)
        return service
    except HttpError as error:
        print(f'An error occurred: {error}')
        return None

def get_or_create_folder(service, folder_name, parent_id=None):
    """Checks if a folder exists, creates it if it doesn't."""
    escaped_name = escape_drive_query(folder_name)
    query = f"name = '{escaped_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
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

def archive_old_files(service, target_folder_id, file_name_prefix):
    """
    Lista arquivos na pasta destino que começam com o prefixo (ex: 'Essenza - LAUDO DE VIABILIDADE')
    e os move para a subpasta 'arquivados'.
    """
    # 1. Encontrar a pasta 'arquivados' dentro da target_folder, ou criar se não existir
    archive_folder_id = get_or_create_folder(service, "arquivados", parent_id=target_folder_id)
    
    # 2. Buscar arquivos que correspondam ao prefixo na target_folder (ignorando a própria pasta arquivados)
    # A query busca arquivos cujo nome contenha o prefixo.
    escaped_prefix = escape_drive_query(file_name_prefix)
    query = f"'{target_folder_id}' in parents and name contains '{escaped_prefix}' and mimeType != 'application/vnd.google-apps.folder' and trashed = false"
    try:
        results = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
        items = results.get('files', [])
        
        for item in items:
            file_id = item['id']
            print(f"📦 Arquivando versão anterior no Drive: {item['name']}")
            # Move o arquivo: adiciona a pasta 'arquivados' e remove da pasta 'target_folder'
            service.files().update(
                fileId=file_id,
                addParents=archive_folder_id,
                removeParents=target_folder_id,
                fields='id, parents'
            ).execute()
    except HttpError as error:
        print(f"⚠️ Erro ao arquivar arquivos antigos no Drive: {error}")

def upload_file(local_path, marca, cliente=None):
    """Uploads a file to Google Drive under 'Possiveis Clientes/[marca] - [cliente]'."""
    print(f"🚀 Iniciando upload para o Google Drive: {os.path.basename(local_path)}")
    service = get_service()
    if not service:
        print("❌ Erro ao conectar com o Google Drive.")
        return

    try:
        # 1. Garantir pasta principal
        root_folder_id = get_or_create_folder(service, "Possiveis Clientes")
        
        # 2. Formatar nome da pasta do cliente
        folder_name = marca
        if cliente and cliente.strip():
            folder_name = f"{marca} - {cliente}"
            
        target_folder_id = get_or_create_folder(service, folder_name, parent_id=root_folder_id)

        # 3. Arquivar versões anteriores (baseado no nome base, ex: 'Essenza - LAUDO')
        # Pega a primeira parte do nome do arquivo para servir de prefixo de busca
        base_prefix = os.path.basename(local_path).split('.')[0]
        # Para evitar mover coisas erradas, limitamos a busca ao nome da marca + traço
        safe_prefix = f"{marca} - "
        archive_old_files(service, target_folder_id, safe_prefix)

        # 4. Upload do arquivo novo
        file_metadata = {
            'name': os.path.basename(local_path),
            'parents': [target_folder_id]
        }
        media = MediaFileUpload(local_path, resumable=True)
        file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
        
        print(f"✅ Upload concluído! ID do arquivo: {file.get('id')}")
        return file.get('id')

    except HttpError as error:
        print(f'❌ Erro no upload: {error}')
        return None

if __name__ == "__main__":
    # Teste simples se executado diretamente
    import sys
    if len(sys.argv) > 1:
        upload_file(sys.argv[1], "Teste")
    else:
        print("Uso: python google_drive_service.py <caminho_arquivo>")
