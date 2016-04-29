var serialport = require("serialport");
var sinon = require('sinon');
var should = require('should');
var m;

var Mirobot = function(port, cb){
  var self = this;
  self.cb = undefined;
  
  var init = function(port, cb){
    self.s = new serialport.SerialPort(port, {
      baudrate: 57600,
      parser: serialport.parsers.readline('\r\n')
    });
    self.s.on('open', function () {
      setTimeout(cb, 2000);
    });
    self.s.on('data', function (data) {
      //console.log(data);
      self.cb(JSON.parse(data));
    });
  }
  
  this.send = function(str, cb){
    //console.log(str);
    self.msgs = [];
    self.s.write(str + "\r\n", function(err, bytesWritten) {
      self.cb = cb;
    });
  }
  
  init(port, cb);
}

function validateArg(arg, expected){
  for(var i in expected){
    if(expected.hasOwnProperty(i)){
      arg.should.have.property(i);
      if(expected[i] instanceof RegExp){
        arg[i].should.match(expected[i]);
      }else if(typeof expected[i] === 'string'){
        arg[i].should.equal(expected[i]);
        arg[i].should.be.a.String();
      }else if(expected[i] instanceof Number){
        arg[i].should.equal(expected[i]);
        arg[i].should.be.a.Number();
      }
    }  
  }
  for(var i in arg){
    expected.should.have.property(i);
  }
}

function validateAcceptAndComplete(spy, done, completeDelay){
  var accepted = false;
  setTimeout(function(){
    accepted = true;
    sinon.assert.calledOnce(spy);
    validateArg(spy.getCall(0).args[0], {status: 'accepted', id: 'foo'});
  }, 50);
  setTimeout(function(){
    accepted.should.equal(true);
    sinon.assert.calledTwice(spy);
    validateArg(spy.getCall(1).args[0], {status: 'complete', id: 'foo'});
    done();
  }, completeDelay);
}

describe('Mirobot', function(){
  before(function(done){
    this.timeout(5000);
    m = new Mirobot("/dev/tty.usbserial-FTE3AQ5M", function(){
      done();
    });
  });
  
  beforeEach(function(done){
    m.send('{"cmd":"stop","id":"stopid"}', function(resp){
      validateArg(resp, {status: 'complete', id: "stopid"});
      done();
    });
  });

  it('should handle bad JSON', function(done){
    var spy = sinon.spy();
    m.send('{"cmd":"version}', spy);
    setTimeout(function(){
      sinon.assert.calledOnce(spy);
      validateArg(spy.getCall(0).args[0], {status: 'error', msg: "JSON parse error"});
      done();
    }, 50);
  });
  
  it('should handle unknown commands', function(done){
    var spy = sinon.spy();
    m.send('{"cmd":"blah"}', spy);
    setTimeout(function(){
      sinon.assert.calledOnce(spy);
      validateArg(spy.getCall(0).args[0], {status: 'error', msg: "Command not recognised"});
      done();
    }, 50);
  });
  
  it('should not allow more than one long running command to run at a time', function(done){
    var spy = sinon.spy();
    m.send('{"cmd":"forward","arg":"10","id":"foo"}', spy);
    var accepted = false;
    var errored = false;
    setTimeout(function(){
      sinon.assert.calledOnce(spy);
      validateArg(spy.getCall(0).args[0], {status: 'accepted', id: 'foo'});
      accepted = true;
      m.send('{"cmd":"forward","arg":"10","id":"bar"}', spy);
    }, 50);
    setTimeout(function(){
      accepted.should.equal(true);
      sinon.assert.calledTwice(spy);
      validateArg(spy.getCall(1).args[0], {status: 'error', id: 'bar', msg: "Previous command not finished"});
      errored = true;
    }, 100);
    setTimeout(function(){
      accepted.should.equal(true);
      errored.should.equal(true);
      sinon.assert.calledThrice(spy);
      validateArg(spy.getCall(2).args[0], {status: 'complete', id: 'foo'});
      done();
    }, 400);
  });

  it('should not require sending an id', function(done){
    var spy = sinon.spy();
    m.send('{"cmd":"version"}', spy);
    setTimeout(function(){
      sinon.assert.calledOnce(spy);
      validateArg(spy.getCall(0).args[0], {status: 'complete', msg: /\d+\.\d+\.\d+/});
      done();
    }, 50);
  });

  it('should send version', function(done){
    var spy = sinon.spy();
    m.send('{"cmd":"version","id":"foo"}', spy);
    setTimeout(function(){
      sinon.assert.calledOnce(spy);
      validateArg(spy.getCall(0).args[0], {status: 'complete', id: 'foo', msg: /\d+\.\d+\.\d+/});
      done();
    }, 50);
  });

  it('should ping', function(done){
    var spy = sinon.spy();
    m.send('{"cmd":"ping","id":"foo"}', spy);
    setTimeout(function(){
      sinon.assert.calledOnce(spy);
      validateArg(spy.getCall(0).args[0], {status: 'complete', id: 'foo'});
      done();
    }, 50);
  });
  
  it('should send uptime', function(done){
    var spy = sinon.spy();
    m.send('{"cmd":"uptime","id":"foo"}', spy);
    setTimeout(function(){
      sinon.assert.calledOnce(spy);
      var arg = spy.getCall(0).args[0];
      validateArg(arg, {status: 'complete', id: 'foo', msg: /\d+/});
      arg.msg.should.be.a.Number();
      done();
    }, 50);
  });
  
  it('should pause and resume', function(done){
    var spy = sinon.spy();
    m.send('{"cmd":"forward","arg":"10","id":"moveid"}', spy);
    var steps = 0
    setTimeout(function(){
      steps++;
      sinon.assert.calledOnce(spy);
      validateArg(spy.getCall(0).args[0], {status: 'accepted', id: 'moveid'});
      accepted = true;
      m.send('{"cmd":"pause","id":"boo"}', spy);
    }, 50);
    setTimeout(function(){
      steps++;
      accepted.should.equal(true);
      sinon.assert.calledTwice(spy);
      validateArg(spy.getCall(1).args[0], {status: 'complete', id: 'boo'});
      paused = true
      m.send('{"cmd":"resume","id":"bar"}', spy);
    }, 400);
    setTimeout(function(){
      steps++;
      accepted.should.equal(true);
      sinon.assert.calledThrice(spy);
      validateArg(spy.getCall(2).args[0], {status: 'complete', id: 'bar'});
    }, 450);
    setTimeout(function(){
      steps.should.equal(3);
      sinon.assert.callCount(spy, 4);
      validateArg(spy.getCall(3).args[0], {status: 'complete', id: 'moveid'});
      done();
    }, 1000);
  });
  
  it('should stop', function(done){
    var spy = sinon.spy();
    m.send('{"cmd":"forward","arg":"10","id":"foo"}', spy);
    var accepted = false;
    setTimeout(function(){
      accepted = true;
      sinon.assert.calledOnce(spy);
      validateArg(spy.getCall(0).args[0], {status: 'accepted', id: 'foo'});
      m.send('{"cmd":"stop","id":"stopid"}', spy);
    }, 50);
    setTimeout(function(){
      accepted.should.equal(true);
      sinon.assert.calledThrice(spy);
      validateArg(spy.getCall(1).args[0], {status: 'complete', id: 'stopid'});
      validateArg(spy.getCall(2).args[0], {status: 'complete', id: 'foo'});
      done();
    }, 100);
  });
  
  it('should send the collide state', function(done){
    var spy = sinon.spy();
    m.send('{"cmd":"collideState","id":"foo"}', spy);
    setTimeout(function(){
      sinon.assert.calledOnce(spy);
      validateArg(spy.getCall(0).args[0], {status: 'complete', id: 'foo', msg: "none"});
      done();
    }, 50);
  });
  
  it('should enable collide notifications', function(done){
    var spy = sinon.spy();
    m.send('{"cmd":"collideNotify","id":"foo"}', spy);
    setTimeout(function(){
      sinon.assert.calledOnce(spy);
      validateArg(spy.getCall(0).args[0], {status: 'complete', id: 'foo'});
      m.send('{"cmd":"collideNotify","arg":"false","id":"foo"}', function(){
        done();
      });
    }, 50);
  });
  
  it('should send the follow state', function(done){
    var spy = sinon.spy();
    m.send('{"cmd":"followState","id":"foo"}', spy);
    setTimeout(function(){
      sinon.assert.calledOnce(spy);
      validateArg(spy.getCall(0).args[0], {status: 'complete', id: 'foo', msg: /-?\d+/g});
      done();
    }, 50);
  });
  /*
  // Difficult to test this without a proper test harness
  it('should enable follow notifications', function(done){
    var spy = sinon.spy();
    m.send('{"cmd":"followNotify","id":"foo"}', spy);
    setTimeout(function(){
      sinon.assert.calledOnce(spy);
      var arg = spy.getCall(0).args[0];
      validateParam(arg, 'status', 'complete');
      validateParam(arg, 'id', 'foo');
      arg.should.not.have.property('msg');
      m.send('{"cmd":"followNotify","arg":"false","id":"foo"}', function(){
        done();
      });
    }, 50);
  });
  */
  it('should move forward', function(done){
    var spy = sinon.spy();
    m.send('{"cmd":"forward","arg":"10","id":"foo"}', spy);
    validateAcceptAndComplete(spy, done, 400)
  });
  
  it('should move back', function(done){
    var spy = sinon.spy();
    m.send('{"cmd":"back","arg":"10","id":"foo"}', spy);
    validateAcceptAndComplete(spy, done, 400)
  });
  
  it('should turn right', function(done){
    var spy = sinon.spy();
    m.send('{"cmd":"right","arg":"10","id":"foo"}', spy);
    validateAcceptAndComplete(spy, done, 400)
  });
  
  it('should turn left', function(done){
    var spy = sinon.spy();
    m.send('{"cmd":"left","arg":"10","id":"foo"}', spy);
    validateAcceptAndComplete(spy, done, 400)
  });
  
  it('should move the pen up', function(done){
    var spy = sinon.spy();
    m.send('{"cmd":"penup","id":"foo"}', spy);
    validateAcceptAndComplete(spy, done, 200)
  });
  
  it('should move the pen down', function(done){
    var spy = sinon.spy();
    m.send('{"cmd":"pendown","id":"foo"}', spy);
    validateAcceptAndComplete(spy, done, 200)
  });
  
  it('should beep', function(done){
    var spy = sinon.spy();
    m.send('{"cmd":"beep","arg":"100","id":"foo"}', spy);
    validateAcceptAndComplete(spy, done, 150)
  });
  
});


/*
Still to test:
  calibrateSlack
  slackCalibration
  moveCalibration
  turnCalibration
  calibrateMove 
  calibrateTurn
  follow   
  collide
*/
