/**
 * Zotero Plugin Build Script
 * Uses esbuild to bundle the plugin
 */
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Build plugin.js bundle
esbuild.build({
  entryPoints: [path.join(srcDir, 'index.js')],
  bundle: true,
  platform: 'browser',
  target: 'firefox115',
  outfile: path.join(distDir, 'plugin.js'),
  format: 'iife',
  minify: process.env.NODE_ENV === 'production',
  sourcemap: process.env.NODE_ENV !== 'production',
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
}).then(() => {
  console.log('✓ plugin.js built successfully');
}).catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});

// Copy manifest.json to dist
const manifestSrc = path.join(srcDir, 'manifest.json');
const manifestDest = path.join(distDir, 'manifest.json');
if (fs.existsSync(manifestSrc)) {
  fs.copyFileSync(manifestSrc, manifestDest);
  console.log('✓ manifest.json copied to dist');
}

// Copy locale files to dist
const localeSrc = path.join(srcDir, 'locale');
const localeDest = path.join(distDir, 'locale');
if (fs.existsSync(localeSrc)) {
  if (!fs.existsSync(localeDest)) {
    fs.mkdirSync(localeDest, { recursive: true });
  }
  const localeFiles = fs.readdirSync(localeSrc);
  localeFiles.forEach(file => {
    fs.copyFileSync(
      path.join(localeSrc, file),
      path.join(localeDest, file)
    );
    console.log(`✓ locale/${file} copied to dist`);
  });
}

console.log('\n✓ Build complete! Output in dist/');
