import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ResourceLists {
  vectorize: string[];
  d1: string[];
  kv: string[];
  r2: string[];
}

async function getResourceLists(): Promise<ResourceLists> {
  try {
    const [vectorize, d1, kv, r2] = await Promise.all([
      execAsync('wrangler vectorize list').then(({stdout}) => 
        stdout.split('\n').filter(line => line.trim())),
      execAsync('wrangler d1 list').then(({stdout}) => 
        stdout.split('\n').filter(line => line.trim())),
      execAsync('wrangler kv:namespace list').then(({stdout}) => 
        stdout.split('\n').filter(line => line.trim())),
      execAsync('wrangler r2 bucket list').then(({stdout}) => 
        stdout.split('\n').filter(line => line.trim()))
    ]);

    return { vectorize, d1, kv, r2 };
  } catch (error) {
    console.error('Error fetching resource lists:', error);
    return { vectorize: [], d1: [], kv: [], r2: [] };
  }
}

async function setup() {
  try {
    // Fetch all resource lists at once
    console.log('Fetching existing resources...');
    const lists = await getResourceLists();

    // Create Vectorize indexes
    console.log('Creating Vectorize indexes...');
    try {
      const prodExists = lists.vectorize.some(line => line.includes('rag_system'));
      const previewExists = lists.vectorize.some(line => line.includes('rag_system_preview'));
      
      if (!prodExists) {
        await execAsync('wrangler vectorize create rag_system --dimensions=768 --metric=cosine');
        console.log('Production Vectorize index created successfully');
      }
      if (!previewExists) {
        await execAsync('wrangler vectorize create rag_system_preview --dimensions=768 --metric=cosine');
        console.log('Preview Vectorize index created successfully');
      }
    } catch (e) {
      console.log('Vectorize index setup error:', e);
    }

    // Create D1 databases
    console.log('Creating D1 databases...');
    try {
      const prodExists = lists.d1.some(line => line.includes('rag_system'));
      const previewExists = lists.d1.some(line => line.includes('rag_system_preview'));
      
      if (!prodExists) {
        await execAsync('wrangler d1 create rag_system');
        console.log('Production D1 database created successfully');
      }
      if (!previewExists) {
        await execAsync('wrangler d1 create rag_system_preview');
        console.log('Preview D1 database created successfully');
      }

      // Wait a moment for the databases to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Setup D1 schemas
      console.log('Setting up D1 schemas...');
      await execAsync('npm run setup:db:prod').catch(e => console.error('Production schema setup failed:', e));
      await execAsync('npm run setup:db:preview').catch(e => console.error('Preview schema setup failed:', e));
    } catch (e) {
      console.log('D1 database setup error:', e);
    }

    // Create KV namespaces
    console.log('Creating KV namespaces...');
    try {
      const prodExists = lists.kv.some(line => line.includes('rag_system'));
      const previewExists = lists.kv.some(line => line.includes('rag_system_preview'));
      
      if (!prodExists) {
        await execAsync('wrangler kv:namespace create rag_system');
        console.log('Production KV namespace created successfully');
      }
      if (!previewExists) {
        await execAsync('wrangler kv:namespace create rag_system --preview');
        console.log('Preview KV namespace created successfully');
      }
    } catch (e) {
      console.log('KV namespace setup error:', e);
    }

    // Create R2 buckets
    console.log('Creating R2 buckets...');
    try {
      const prodExists = lists.r2.some(line => line.includes('rag-system'));
      const previewExists = lists.r2.some(line => line.includes('rag-system-preview'));
      
      if (!prodExists) {
        await execAsync('wrangler r2 bucket create rag-system');
        console.log('Production R2 bucket created successfully');
      }
      if (!previewExists) {
        await execAsync('wrangler r2 bucket create rag-system-preview');
        console.log('Preview R2 bucket created successfully');
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