import { clientWithFetcher } from './client.js';

export { methodDescriptor } from './client.js';

export const BaseClient = clientWithFetcher(fetch);