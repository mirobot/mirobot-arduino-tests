
var serialport = require("serialport")
var m;

var Mirobot = function(port, cb){
  var self = this;
  self.cb = undefined;
  self.msgs = [];
  
  var init = function(port, cb){
    self.s = new serialport.SerialPort(port, {
      baudrate: 57600,
      parser: serialport.parsers.readline('\n')
    });
    self.s.on('open', function () {
      cb();
    });
    self.s.on('data', function (data) {
      console.log(data);
      self.msgs.push(data);
      self.cb(self.msgs);
    });
  }
  
  this.send = function(str, timeout, cb){
    console.log(str);
    self.msgs = [];
    self.s.write(str + "\r\n", function(err, bytesWritten) {
      self.cb = cb;
      console.log(bytesWritten);
    });
  }
  
  init(port, cb);
}

m = new Mirobot("/dev/tty.usbserial-FTE3AQ5M", function(){
  m.send('{"cmd":"version","id":"foo"}', 100, function(success, data){
    console.log(data);
  });
})