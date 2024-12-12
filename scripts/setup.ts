import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function checkVectorizeExists(name: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync('wrangler vectorize list');
    return stdout.includes(name);
  } catch {
    return false;
  }
}

async function checkD1Exists(name: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync('wrangler d1 list');
    return stdout.includes(name);
  } catch {
    return false;
  }
}

async function checkKVExists(name: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync('wrangler kv:namespace list');
    return stdout.includes(name);
  } catch {
    return false;
  }
}

async function checkR2Exists(name: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync('wrangler r2 bucket list');
    return stdout.includes(name);
  } catch {
    return false;
  }
}

async function setup() {
  try {
    // Create Vectorize index with correct dimensions
    console.log('Creating Vectorize index...');
    try {
      const vectorizeExists = await checkVectorizeExists('rag_system');
      if (!vectorizeExists) {
        await execAsync('wrangler vectorize create rag_system --dimensions=768 --metric=cosine');
        console.log('Vectorize index created successfully');
      } else {
        console.log('Vectorize index already exists, skipping creation');
      }
    } catch (e) {
      console.log('Vectorize index setup error:', e);
    }

    // Create D1 database
    console.log('Creating D1 database...');
    try {
      const d1Exists = await checkD1Exists('rag_system');
      if (!d1Exists) {
        await execAsync('wrangler d1 create rag_system');
        console.log('D1 database created successfully');
      } else {
        console.log('D1 database already exists, skipping creation');
      }

      // Setup D1 schema
      console.log('Setting up D1 schema...');
      await execAsync('npm run setup:db');
    } catch (e) {
      console.log('D1 database setup error:', e);
    }

    // Create KV namespace
    console.log('Creating KV namespaces...');
    try {
      const kvExists = await checkKVExists('rag_system');
      if (!kvExists) {
        await execAsync('wrangler kv:namespace create rag_system');
        console.log('KV namespace created successfully');
      } else {
        console.log('KV namespace already exists, skipping creation');
      }
    } catch (e) {
      console.log('KV namespace setup error:', e);
    }

    // Create R2 bucket
    console.log('Creating R2 bucket...');
    try {
      const r2Exists = await checkR2Exists('rag-system');
      if (!r2Exists) {
        await execAsync('wrangler r2 bucket create rag-system');
        console.log('R2 bucket created successfully');
      } else {
        console.log('R2 bucket already exists, skipping creation');
      }
    } catch (e) {
      console.log('R2 bucket setup error:', e);
    }

    console.log('Setup complete! Please update wrangler.toml with the created resource IDs');
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

setup(); 