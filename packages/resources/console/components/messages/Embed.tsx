import { useRef, useEffect, useCallback } from 'react'
import getConfig from 'next/config'

export default function Embed({ path, commandId }) {
  const embedBaseUrl =
    process.env.NEXT_PUBLIC_EMBED_BASE_URL ||
    process.env.NEXT_PUBLIC_EMBED_BASE_URL_DEFAULT
  const ref: React.Ref<HTMLIFrameElement> = useRef()
  const handleMessage = ({ data: { source, payload } }) => {
    if (source === `/messages/${commandId}/reply`) {
      console.info('received response back', payload)
    }
  }
  const handleFrameLoaded = () => {
    if (ref.current) {
      ref.current.contentWindow.postMessage(
        { source: `/messages/${commandId}`, payload: { path } },
        embedBaseUrl
      )
    }
  }
  useEffect(() => {
    if (typeof window !== 'undefined' && ref.current) {
      window.addEventListener('message', handleMessage)
      ref.current.addEventListener('load', handleFrameLoaded)
      return () => {
        window.removeEventListener('message', handleMessage)
        ref.current.removeEventListener('load', handleFrameLoaded)
      }
    }
  }, [])
  const isDifferentHost =
    typeof window !== 'undefined' &&
    window.location.href.startsWith(embedBaseUrl)
  return isDifferentHost ? null : (
    <div>
      <iframe
        ref={ref}
        sandbox="allow-scripts allow-same-origin"
        src={`${embedBaseUrl}/embed${path}`}
      />
      <style jsx>{`
        iframe {
          border: 0;
          width: 100%;
        }
      `}</style>
    </div>
  )
}
