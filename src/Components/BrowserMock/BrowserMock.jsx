import './BrowserMock.css'

function BrowserMock({ name, url, color, art }) {
  return (
    <div className="browser" style={{ '--c': color }}>
      <div className="browser-bar">
        <i></i>
        <i></i>
        <i></i>
        <span>{url}</span>
      </div>

      <div className="mock">
        <div className="mock-nav">
          <b>{name}</b>
          <span>
            <i></i>
            <i></i>
            <i></i>
          </span>
        </div>

        <div className="mock-hero">
          <div className="mock-text">
            <i></i>
            <i></i>
            <i></i>
            <i></i>
            <u></u>
          </div>

          {art === 'data' ? (
            <div className="mock-art data">
              <i style={{ height: '45%' }}></i>
              <i style={{ height: '80%' }}></i>
              <i style={{ height: '60%' }}></i>
              <i style={{ height: '95%' }}></i>
            </div>
          ) : (
            <div className="mock-art"></div>
          )}
        </div>

        <div className="mock-cards">
          <i></i>
          <i></i>
          <i></i>
        </div>
      </div>
    </div>
  )
}

export default BrowserMock