import { execSync } from 'child_process';

async function setup() {
  console.log('🚀 Setting up local development environment...');

  try {
    // Install dependencies
    console.log('\n📦 Installing dependencies...');
    execSync('npm install', { stdio: 'inherit' });

    // Create local D1 database
    console.log('\n🗄️  Creating local D1 database...');
    execSync('wrangler d1 create rag_system --local', { stdio: 'inherit' });

    // Apply database schema
    console.log('\n📝 Applying database schema...');
    execSync('npm run setup:db', { stdio: 'inherit' });

    // Create local KV namespace
    console.log('\n🔑 Creating local KV namespace...');
    execSync('wrangler kv:namespace create CACHE --local', { stdio: 'inherit' });

    // Create local R2 bucket
    console.log('\n📦 Creating local R2 bucket...');
    execSync('wrangler r2 bucket create rag-storage --local', { stdio: 'inherit' });

    console.log('\n✅ Setup complete! You can now run:');
    console.log('npm run dev');
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  }
}

setup(); 