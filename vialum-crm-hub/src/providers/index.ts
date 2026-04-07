import { registerProvider } from './provider.registry.js';
import { registerTaskProvider } from './task-provider.registry.js';
import { PipedriveProvider } from './pipedrive/pipedrive.provider.js';
import { ClickUpProvider } from './clickup/clickup.provider.js';
import { GDriveProvider } from './gdrive/gdrive.provider.js';
import { RDStationProvider } from './rdstation/rdstation.provider.js';
import { ClickUpTaskProvider } from './clickup/clickup.task-provider.js';

export function initProviders(): void {
  // Read-only integration providers (IntegrationProvider interface)
  registerProvider(new PipedriveProvider());   // category: crm
  registerProvider(new ClickUpProvider());     // category: tasks
  registerProvider(new GDriveProvider());      // category: documents
  registerProvider(new RDStationProvider());   // category: marketing

  // Write-capable task providers (TaskProvider interface)
  registerTaskProvider(new ClickUpTaskProvider());
}
