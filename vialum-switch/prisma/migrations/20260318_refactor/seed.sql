-- Etapa 2: Seed Genesis (account_id = ee28092e-bd02-4d50-a920-b419e01adc8a)

-- Auto-rules
INSERT INTO switch_auto_rules (account_id, name, source, event, mime_pattern, processors, priority) VALUES
('ee28092e-bd02-4d50-a920-b419e01adc8a', 'Imagens → OCR + Classify', '*', 'file.created', 'image/*',
 '[{"processor":"ocr"},{"processor":"classify","params":{"classifier":"document_type"}}]'::jsonb, 10),
('ee28092e-bd02-4d50-a920-b419e01adc8a', 'PDFs → OCR + Classify', '*', 'file.created', 'application/pdf',
 '[{"processor":"ocr"},{"processor":"classify","params":{"classifier":"document_type"}}]'::jsonb, 10),
('ee28092e-bd02-4d50-a920-b419e01adc8a', 'Audio → Transcribe', '*', 'file.created', 'audio/*',
 '[{"processor":"transcribe"}]'::jsonb, 10),
('ee28092e-bd02-4d50-a920-b419e01adc8a', 'Video → Transcribe', '*', 'file.created', 'video/*',
 '[{"processor":"transcribe"}]'::jsonb, 10)
ON CONFLICT DO NOTHING;

-- Classifiers
INSERT INTO switch_classifiers (account_id, name, description, labels) VALUES
('ee28092e-bd02-4d50-a920-b419e01adc8a', 'document_type', 'Classifica tipo de documento brasileiro',
 '{
   "RG": {"strong":["REGISTRO GERAL","INSTITUTO DE IDENTIFICAÇÃO","CARTEIRA DE IDENTIDADE"],"weak":["SECRETARIA DE SEGURANÇA","FILIAÇÃO","NATURALIDADE","DOC. ORIGEM"]},
   "CNH": {"strong":["CARTEIRA NACIONAL DE HABILITAÇÃO","PERMISSÃO PARA DIRIGIR"],"weak":["CATEGORIA","DETRAN","HABILITAÇÃO","RENACH"]},
   "CPF": {"strong":["CADASTRO DE PESSOAS FÍSICAS","RECEITA FEDERAL"],"weak":["MINISTÉRIO DA FAZENDA","INSCRIÇÃO"]},
   "COMPROVANTE_RESIDENCIA": {"strong":["CONTA DE ENERGIA","CONTA DE LUZ","CONTA DE ÁGUA","CONTA DE GÁS","NOTA FISCAL DE ENERGIA","DANFE","ENERGIA ELÉTRICA"],"weak":["FATURA","VENCIMENTO","KWH","CONSUMO","CEMIG","COPASA","SABESP","CPFL","ENEL","ENERGISA","LEITURA","MEDIDOR","ROTEIRO DE LEITURA","DATA DE APRESENTAÇÃO","TARIFA","DISTRIBUIDORA"]},
   "COMPROVANTE_PAGAMENTO": {"strong":["COMPROVANTE DE TRANSFERÊNCIA","COMPROVANTE PIX","TRANSFERÊNCIA EFETUADA","COMPROVANTE DE PAGAMENTO"],"weak":["CHAVE PIX","VALOR DEBITADO","BANCO","CÓDIGO DE BARRAS","PAGADOR","FAVORECIDO","VALOR PAGO","BCO DO BRASIL","CAIXA ECONOMICA","ITAU","BRADESCO","SANTANDER","NUBANK","INTER"]},
   "GRU_INPI": {"strong":["GUIA DE RECOLHIMENTO DA UNIÃO","GRU SIMPLES","INSTITUTO NACIONAL DA PROPRIEDADE"],"weak":["INPI","CÓDIGO DE RECEITA","MINISTÉRIO DA ECONOMIA","TESOURO NACIONAL","PROPRIEDADE INDUSTRIAL"]},
   "CONTRATO": {"strong":["CONTRATO DE PRESTAÇÃO DE SERVIÇOS","CLÁUSULA PRIMEIRA"],"weak":["CONTRATANTE","CONTRATADO","FORO","TESTEMUNHAS"]},
   "PROCURACAO": {"strong":["PROCURAÇÃO","OUTORGANTE","OUTORGADO"],"weak":["PODERES","SUBSTABELECER","INPI"]},
   "CERTIFICADO_PROFISSIONAL": {"strong":["CERTIFICAMOS QUE","CERTIFICADO DE CONCLUSÃO"],"weak":["CARGA HORÁRIA","APROVEITAMENTO","CURSO"]}
 }'::jsonb),
('ee28092e-bd02-4d50-a920-b419e01adc8a', 'payment_proof', 'Verifica tipo de comprovante de pagamento',
 '{
   "COMPROVANTE_PIX": {"strong":["COMPROVANTE PIX","PIX ENVIADO","TRANSFERÊNCIA PIX","PIX REALIZADO"],"weak":["CHAVE PIX","BANCO CENTRAL","IDENTIFICADOR"]},
   "COMPROVANTE_TED": {"strong":["COMPROVANTE TED","TRANSFERÊNCIA ENTRE BANCOS"],"weak":["TED","DOC","CÂMARA INTERBANCÁRIA"]},
   "BOLETO_PAGO": {"strong":["COMPROVANTE DE PAGAMENTO DE BOLETO","BOLETO PAGO"],"weak":["CÓDIGO DE BARRAS","LINHA DIGITÁVEL","COMPENSAÇÃO"]},
   "GRU_PAGO": {"strong":["GRU PAGA","GUIA DE RECOLHIMENTO"],"weak":["INPI","TESOURO","CÓDIGO DE RECEITA"]},
   "NAO_COMPROVANTE": {"strong":[],"weak":[]}
 }'::jsonb),
('ee28092e-bd02-4d50-a920-b419e01adc8a', 'signature_check', 'Verifica se documento possui assinatura',
 '{
   "ASSINADO": {"strong":["ASSINADO DIGITALMENTE","CERTIFICADO DIGITAL","ASSINATURA ELETRÔNICA","GOV.BR"],"weak":["VALIDAR","AUTENTICIDADE","ICP-BRASIL","HASH","CARIMBO DO TEMPO"]},
   "NAO_ASSINADO": {"strong":[],"weak":[]}
 }'::jsonb)
ON CONFLICT (account_id, name) DO UPDATE SET labels = EXCLUDED.labels, updated_at = NOW();

-- Strategies
INSERT INTO switch_strategies (account_id, processor, strategy) VALUES
('ee28092e-bd02-4d50-a920-b419e01adc8a', 'ocr',
 '[{"provider":"tesseract","minConfidence":0.7,"fallbackOnLow":true},{"provider":"gemini_flash","minConfidence":0.5,"fallbackOnLow":false}]'::jsonb),
('ee28092e-bd02-4d50-a920-b419e01adc8a', 'classify',
 '[{"provider":"keywords","minConfidence":0.7,"fallbackOnLow":true},{"provider":"gemini_flash","minConfidence":0.5,"fallbackOnLow":false}]'::jsonb),
('ee28092e-bd02-4d50-a920-b419e01adc8a', 'transcribe',
 '[{"provider":"vialum_transcriber","minConfidence":0.5,"fallbackOnLow":false}]'::jsonb)
ON CONFLICT (account_id, processor) DO UPDATE SET strategy = EXCLUDED.strategy, updated_at = NOW();

-- Provider configs
INSERT INTO switch_provider_configs (account_id, provider, credentials, settings) VALUES
('ee28092e-bd02-4d50-a920-b419e01adc8a', 'tesseract', '{}', '{"language":"por","psm":3}'),
('ee28092e-bd02-4d50-a920-b419e01adc8a', 'gemini_flash', '{"apiKey":"AIzaSyAK3fc--t9tE7jYkNpdPzEhJhzdQxVkHqc"}', '{"model":"gemini-2.0-flash-lite"}'),
('ee28092e-bd02-4d50-a920-b419e01adc8a', 'vialum_transcriber', '{}', '{"url":"http://transcriber-api:8000/transcribe"}'),
('ee28092e-bd02-4d50-a920-b419e01adc8a', 'keywords', '{}', '{}')
ON CONFLICT (account_id, provider) DO UPDATE SET credentials = EXCLUDED.credentials, settings = EXCLUDED.settings;
