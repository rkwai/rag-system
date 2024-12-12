import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function setup() {
  try {
    // Create Vectorize index with correct dimensions
    console.log('Creating Vectorize index...');
    try {
      await execAsync('wrangler vectorize delete rag_system'); // Delete existing index
      await execAsync('wrangler vectorize create rag_system --dimensions=768 --metric=cosine');
    } catch (e) {
      console.log('Vectorize index setup error, continuing...');
    }

    // Create D1 database
    console.log('Creating D1 database...');
    try {
      const d1Result = await execAsync('wrangler d1 create rag_system');
      console.log('D1 database created:', d1Result.stdout);
    } catch (e) {
      console.log('D1 database might already exist, continuing...');
    }

    // Setup D1 schema
    console.log('Setting up D1 schema...');
    await execAsync('npm run setup:db');

    // Create KV namespace
    console.log('Creating KV namespaces...');
    try {
      const kvResult = await execAsync('wrangler kv:namespace create CACHE');
      console.log('KV namespace created:', kvResult.stdout);
      const previewKvResult = await execAsync('wrangler kv:namespace create CACHE --preview');
      console.log('Preview KV namespace created:', previewKvResult.stdout);
    } catch (e) {
      console.log('KV namespace might already exist, continuing...');
    }

    // Create R2 bucket
    console.log('Creating R2 bucket...');
    try {
      await execAsync('wrangler r2 bucket create rag_system');
    } catch (e) {
      console.log('R2 bucket might already exist, continuing...');
    }

    console.log('Setup complete! Please update wrangler.toml with the created resource IDs');
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

setup(); 