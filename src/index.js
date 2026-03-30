import express from 'express';
const app = express();
const port = 3000;

function format(seconds){
  function pad(s){
    return (s < 10 ? '0' : '') + s;
  }
  var hours = Math.floor(seconds / (60*60));
  var minutes = Math.floor(seconds % (60*60) / 60);
  var seconds = Math.floor(seconds % 60);

  return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
}

app.get('/health', (req, res) => {
    res.json({
        "nama": "Christina Tan",
        "nrp": "5025241060",
        "status": "UP",
        "timestamp": new Date().toISOString(),
        "uptime": format(process.uptime())
    })
})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})