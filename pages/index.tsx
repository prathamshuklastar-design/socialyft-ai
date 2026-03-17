export default function Home() {
  return (
    <>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background:#080808; }
      `}</style>
      <script dangerouslySetInnerHTML={{__html: `
        window.location.replace('/index.html');
      `}} />
    </>
  )
}