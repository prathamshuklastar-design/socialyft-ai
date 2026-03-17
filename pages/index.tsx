import { useEffect } from 'react'

export default function Home() {
  useEffect(() => {
    document.title = 'Socialyft AI'
  }, [])

  return (
    <iframe
      src="/index.html"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        border: 'none'
      }}
    />
  )
}