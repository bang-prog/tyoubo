// BIZ UDPゴシック(ユニバーサルデザインのフォント)。太さは 400 と 700 の2種類だけ
import '@fontsource/biz-udpgothic/400.css'
import '@fontsource/biz-udpgothic/700.css'
import './styles/global.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App.tsx'
import PinGate from './components/pin/PinGate'
import { requestPersistentStorage } from './lib/storage'

// 端末の空き容量が少なくなっても、ブラウザにデータを消されにくくする(仕様書 §9)
void requestPersistentStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <PinGate>
        <App />
      </PinGate>
    </BrowserRouter>
  </StrictMode>,
)
