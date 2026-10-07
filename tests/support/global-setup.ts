import { hapusDatabaseTest, siapkanTemplate } from './pg';

export async function setup(): Promise<void> {
  await siapkanTemplate();
}

export async function teardown(): Promise<void> {
  await hapusDatabaseTest();
}
