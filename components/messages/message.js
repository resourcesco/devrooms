import Help from "./help"
import Data from './data'
import { useState } from 'react'

export default ({type, code, text, url, content, theme, ...props}) => {
  const [loaded, setLoaded] = useState(false)
  const handleLoaded = () => {
    setLoaded(true)
    onLoad()
  }
  if (type === 'help') {
    return <Help theme={theme} />
  } else if (type === 'error') {
    if (code === 'not_found') {
      return <div>Results not found.</div>
    } else {
      return <div>{text || 'Unknown error.'}</div>
    }
  } else if (type === 'link') {
    return <div><a target="_blank" href={url}>{text}</a></div>
  } else if (type === 'text') {
    return <div>
        {text.split("\n").map((s, i) => <div key={i}>{s}</div>)}
    </div>
  } else if (type === 'input') {
    return <div className="input-message">{text.split("\n").map((s, i) => <div key={i}>{s}</div>)}</div>
  } else if (type === 'image') {
    const { onLoad } = props
    const imageStyle = (loaded ?
      {maxHeight: '50vh'} :
      {height: '50vh'})
    return <img src={url} style={imageStyle} onLoad={() => setTimeout(handleLoaded, 10)} />
  } else if (type === 'data') {
    const { data, keyField, title, link, pickPrefix, onPickId } = props
    return <Data
      data={data} keyField={keyField} title={title} link={link} theme={theme}
      onPickId={onPickId} pickPrefix={pickPrefix}
    />
  } else {
    return null
  }
}
