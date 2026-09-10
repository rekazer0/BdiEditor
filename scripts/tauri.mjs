import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const args = process.argv.slice(2)
let server

try {
  // Own the frontend server so its actual port can be passed to the webview.
  // Leave other Tauri commands (including mobile dev and help) unchanged.
  if (args[0] === 'dev' && !args.includes('--help') && !args.includes('-h')) {
    const { createServer } = await import('vite')
    server = await createServer({
      root: fileURLToPath(new URL('../', import.meta.url)),
      server: { host: '127.0.0.1', port: 1420, strictPort: false },
    })
    await server.listen()
    const address = server.httpServer.address()
    const devUrl = `http://127.0.0.1:${address.port}`
    console.log(`Desktop frontend: ${devUrl}`)
    args.splice(1, 0, '--config', JSON.stringify({
      build: { beforeDevCommand: '', devUrl },
    }))
  }

  const child = spawn(process.execPath, [require.resolve('@tauri-apps/cli/tauri.js'), ...args], {
    stdio: 'inherit',
  })
  const stop = () => child.kill('SIGTERM')
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  try {
    process.exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', (code, signal) => resolve(code ?? (signal === 'SIGINT' ? 130 : 1)))
    })
  } finally {
    process.removeListener('SIGINT', stop)
    process.removeListener('SIGTERM', stop)
  }
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await server?.close()
}
