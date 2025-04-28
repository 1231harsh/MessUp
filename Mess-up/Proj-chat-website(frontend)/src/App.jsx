import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="container text-center mt-5">
      <h1 className="mb-4">Vite + React + Bootstrap</h1>
      
      <div className="card p-4">
        <h2 className="mb-3">Counter: {count}</h2>
        <button 
          className="btn btn-primary me-2" 
          onClick={() => setCount(count + 1)}
        >
          Increment
        </button>
        <button 
          className="btn btn-danger" 
          onClick={() => setCount(count - 1)}
        >
          Decrement
        </button>
      </div>
    </div>
  )
}

export default App
