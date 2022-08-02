var h1, txt1, btn1, btn9, div1;
var lastNotification = 0;  
var lastTrackerUpdate = 0;  
var skipNotifyMinutes = 60;
var maxIdleMinutes = 60;
var repeatSeconds = 20;
var geoLocWatchId = 0;
var watch = false;

function showNotification(title, body) {
  //console.log("showNotification");
  var thisTime = new Date();
  if ( (thisTime.getTime()-lastNotification) < (skipNotifyMinutes*60000) ) return;
  Notification.requestPermission().then(function(permission) {
    if (permission === 'granted') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(function(reg) {
          //console.log("ready");
          reg.showNotification(title,{body: body});
          lastNotification = (new Date()).getTime();  
        });
      }
    }
  });
}

function registerPushManager() {
  Notification.requestPermission().then(function(permission) {
    if (permission === 'granted') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(function(reg) {
          reg.pushManager.subscribe({
            userVisibleOnly: true
          }).then(function(sub) {
            console.log('Endpoint URL: ', sub.endpoint);
          }).catch(function(e) {
            if (Notification.permission === 'denied') {
              console.warn('Permission for notifications was denied');
            } else {
              console.error('Unable to subscribe to push', e);
            }
          });
        })
      }
    }
  });
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(function(reg) {
      console.log('Service Worker Registered!', reg);
      reg.pushManager.getSubscription().then(function(sub) {
        if (sub === null) {
        } else {
          console.log('Subscription object: ', sub);
          registerPushManager();
        }
      });
    }).catch(function(e) {
      console.log('SW reg failed');
    });
  }
}

/*
// !! ver3.0 only !!
navigator.serviceWorker.register("sw.js").then(registration => {
  registration.systemMessageManager.subscribe("alarm").then(
    rv => {
      console.log('app.js: Successfully subscribe system messages of name "alarm".');
    },
    error => {
      console.log("app.js: Fail to subscribe system message, error: " + error);
    }
  );
});
*/

var myData = {"store":null, "lastExecuteTime":null};

function updateMyData(name, value) {
  navigator.getDataStores('myData').then(function(stores){
    myData.store = stores[0];
    myData.store.get(name).then(function(obj){
      //found, so will update it
      //console.log("updating "+name+"...");
      myData.store.put(value,name).then(function(id){
        myData[name] = value;
        //console.log(name+" updated");
      });
    }).catch(function(err){
      //console.log("adding "+name+"...");
      myData.store.add(value,name).then(function(id){
        myData[name] = value;
        //console.log(name+" added");
      });
    });
  });
}

var alrmId = -1;
function cancelAllAlarms() {
  var alrmRq = navigator.mozAlarms.getAll();
  alrmRq.onsuccess = function() {
    this.result.forEach(function(alarm) {
      console.log('removing alarm:', alarm.id);
      //console.log('date:', alarm.date);
      //console.log('respectTimezone:', alarm.respectTimezone);
      //console.log('data:', JSON.stringify(alarm.data));
      navigator.mozAlarms.remove(alarm.id);
    });
  };
  alrmRq.onerror = function() { };  
}
function setNextAlarm(nextSeconds) {
  if ( navigator.mozHasPendingMessage("alarm") ) {
    console.log("alarm pending. skipped adding.");  
    return;
  }

  var thisTime = new Date();
  var thisHour = thisTime.getHours();

  var nextTime = thisTime.getTime() + (nextSeconds*1000);
  var inactiveTime = 1*60000;
  if (  (thisTime.getTime()-lastTrackerUpdate) >= inactiveTime ) {
    // inactive/sleep time, more rest
    nextTime = thisTime.getTime() + (
      (thisHour<6||thisHour>18) ? (inactiveTime*5) : inactiveTime
    );
  }
  
  var alrmTime = thisTime; alrmTime.setTime(nextTime);
  var alrmRq = navigator.mozAlarms.add(alrmTime, 'honorTimezone',{"alrmTime":nextTime});
  alrmRq.onsuccess = function() {
    alrmId = this.result;
    console.log("added next alarm: "+alrmId);  
  };
}
navigator.mozSetMessageHandler('alarm', function(mozAlarm){
  var thisTime = new Date();
  if ( (mozAlarm.date.getTime()-thisTime.getTime()) > 2000 ) {
    console.log("ignored alarm. triggered too early.");
    return;
  }

  showNotification('QuoInsight', 'time-triggered' );
  div1.innerText  = 'alarm: ' + JSON.stringify(mozAlarm.data)
       + ' ' + (new Date()).toLocaleString();
  updateMyData("lastExecuteTime", (new Date()).toLocaleString());

  if (!watch) getLocation(watch);  
  if ( (thisTime.getTime()-lastTrackerUpdate) > (maxIdleMinutes*60000) ) {
    updateTracker(-1,-1);
  }
  setNextAlarm(repeatSeconds);
});

function updateTracker(latitude,longitude) {
  var thisTime = new Date();
  if ( (thisTime.getTime()-lastTrackerUpdate) < (repeatSeconds*1000) ) return;

  var url = "https://script.google.com/macros/s/.../exec";
  var data = '"-","' + latitude + '","' + longitude + '","","",""';
  url = url + "?insertDataRows=%5B%5B"+data+"%5D%5D";
  var request = new XMLHttpRequest({ mozSystem: true });
  request.open('get', url, true);
  request.addEventListener('error', function(){
    console.log("Error:"+request.error);
  });  request.addEventListener('load', function(){
    var response = request.response;
    if (response === null) {
      console.log("Error: response is null");
      return;
    }
    console.log("Response Lenght: "+response.length);
    div1.innerHTML  = response;          
  });
  request.send();
  lastTrackerUpdate = (new Date()).getTime();
  updateMyData("lastTrackerUpdate", lastTrackerUpdate);
  showNotification('QuoInsight', 'lastTrackerUpdate');
}

function clearGeoLocWatch() {
  try { navigator.geolocation.clearWatch(geoLocWatchId); } catch(e) {}
  navigator.getDataStores('myData').then(function(stores){
    myData.store = stores[0];
    myData.store.get("geoLocWatchId").then(function(obj){
      try { navigator.geolocation.clearWatch(obj); } catch(e) {}
    });
  });
}

var geoError = function (e) {
  var errMsg="Error";
  switch (e.code) {
    case e.TIMEOUT:
      errMsg = "geolocation.getCurrentPosition() timeout";
      break;
    default:
      erMsg = "geolocation.getCurrentPosition() error ["+e+"]";
  }
  txt1.value = errMsg;
}

function getLocation(watch) {
  if (! navigator.geolocation) return;

  if (watch) {
    /*
      You cannot watch the user's location from a Web App in background.
	  I have checked it on Chrome (Android M), and as soon as the Web App
	  goes to background the GPS icon disappears and the watch position
	  process is stopped. (Once the Web App is in the foreground again,
	  the watch process is resumed). The same is happening when the device
	  is locked. The watch process is stopped until the user unlocks it
	  and the Web App is in the foreground.
    */
    clearGeoLocWatch();
    txt1.value = "start watchPosition() ..";
    geoLocWatchId = navigator.geolocation.watchPosition(function(p){
      var thisTime = new Date();
      var lat = p.coords.latitude;
      var lon = p.coords.longitude;
      //console.log("coordinate="+lat+","+lon);
      txt1.value = lat + "," + lon;

      updateTracker(lat,lon);
      return;
     /*
      navigator.getDataStores('myData').then(function(stores){
        myData.store = stores[0];
        myData.store.get("lastTrackerUpdate").then(function(obj){
          if ( (thisTime.getTime()-obj) >= (repeatSeconds*1000) ) {
            updateTracker(lat,lon);
          }
        }).catch(function(err){
          updateTracker(lat,lon);
        });
      });
     */
    }, geoError, {
      //timeout: 10000, // default=Infinity !!
      maximumAge: 0, // default=0 nocache !!
      enableHighAccuracy: true // default=false
    });
	console.log("geoLocWatchId: "+geoLocWatchId+" ..");
    txt1.value = "geoLocWatchId: "+geoLocWatchId+" ..";
    updateMyData("geoLocWatchId", geoLocWatchId);

  } else {

	txt1.value = "start getCurrentPosition() ..";
    navigator.geolocation.getCurrentPosition(function(p){
      var lat = p.coords.latitude;
      var lon = p.coords.longitude;
      console.log("coordinate="+lat+","+lon);
      txt1.value = lat + "," + lon;
      updateTracker(lat,lon);
    }, geoError, {
      enableHighAccuracy: true, // default=false
      maximumAge: 0, // default=0 nocache !!
      timeout: (repeatSeconds-5)*1000 // default=Infinity !!
    });

}

}

window.addEventListener("load", function() {
  console.log("Hello 1!");
  registerSW();

  h1 = document.getElementById("h1");
  txt1 = document.getElementById("txt1");
  btn1 = document.getElementById("btn1");
  btn9 = document.getElementById("btn9");
  div1 = document.getElementById("div1");

  btn1.focus();

  navigator.getDataStores('myData').then(function(stores){
    myData.store = stores[0];
    myData.store.get("lastExecuteTime").then(function(obj){
      myData.lastExecuteTime = "*" + obj;
      h1.innerHTML  = "lastExecuteTime: " + myData.lastExecuteTime;
    });
  });
  
  btn1.addEventListener(
      "click", function(){
        h1.innerHTML = (new Date()).toLocaleString();

        showNotification('QuoInsight', 'manual clicked' );
return;
        
        var request = new XMLHttpRequest({ mozSystem: true });
        request.open('get', "http://192.168.43.1", true);
        // We're setting some handlers here for dealing with both error and
        // data received. We could just declare the functions here, but they are in
        // separate functions so that search() is shorter, and more readable.
        request.addEventListener('error', function(){
          console.log("Error:"+request.error);
        });  request.addEventListener('load', function(){
          var response = request.response;
          if (response === null) {
            console.log("Error: response is null");
            return;
          }
          console.log("Response Length: "+response.length);
          div1.innerHTML  = response;          
        });
        request.send();

        getLocation(watch);  
      }
  );

  btn9.addEventListener("click", function(){
      console.log("closing. ..");
      cancelAllAlarms();
      if ( !confirm("close?") ) {
        setNextAlarm(repeatSeconds);
        return;
      }
      //try { navigator.mozAlarms.remove(alrmId); } catch(e) {}
      clearGeoLocWatch();
      window.close();  
  });

  cancelAllAlarms();
  getLocation(watch);
  setNextAlarm(repeatSeconds);
});
