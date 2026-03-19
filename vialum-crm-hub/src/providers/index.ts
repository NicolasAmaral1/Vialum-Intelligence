import { registerProvider } from './provider.registry.js';
import { registerTaskProvider } from './task-provider.registry.js';
import { PipedriveProvider } from './pipedrive/pipedrive.provider.js';
import { ClickUpProvider } from './clickup/clickup.provider.js';
import { GDriveProvider } from './gdrive/gdrive.provider.js';
import { RDStationProvider } from './rdstation/rdstation.provider.js';
import { ClickUpTaskProvider } from './clickup/clickup.task-provider.js';

export function initProviders(): void {
  // Legacy read-only providers (CrmProvider interface)
  registerProvider(new PipedriveProvider());
  registerProvider(new ClickUpProvider());
  registerProvider(new GDriveProvider());
  registerProvider(new RDStationProvider());

  // Agnostic write-capable providers (TaskProvider interface)
  registerTaskProvider(new ClickUpTaskProvider());
}
