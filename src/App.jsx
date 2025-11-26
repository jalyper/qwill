import React from 'react';
import Editor from './components/Editor';

function App() {
  return (
    <div className="app-container" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Editor />
    </div>
  );
}

export default App;
