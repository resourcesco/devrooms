import React, { useState, useRef } from 'react'
import LinkMenu from './LinkMenu'
import StringView from '../generic/StringView'
import { Manager, Reference } from 'react-popper'
import { sanitizeUrl } from '@braintree/sanitize-url'

export default function Link({
  url,
  onEdit,
  context: { onPickId, theme },
  context,
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  const openMenu = e => {
    setMenuOpen(true)
    e.preventDefault()
    return false
  }
  return (
    <span>
      <Manager>
        <Reference>
          {({ ref }) => (
            <a className="vtv--content-link" ref={ref} href={sanitizeUrl(url) || '#'} onClick={openMenu}>
              <StringView value={url} maxLength={120} />
            </a>
          )}
        </Reference>
        {menuOpen && (
          <LinkMenu
            onEdit={onEdit}
            url={url}
            onClose={() => setMenuOpen(false)}
            context={context}
          />
        )}
      </Manager>
    </span>
  )
}
