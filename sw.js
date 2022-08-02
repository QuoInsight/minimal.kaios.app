/*
// !! ver3.0 only !!
self.registration.systemMessageManager.subscribe("alarm").then(
  rv => {
    console.log('sw.js: Successfully subscribe system messages of name "alarm".');
  }, error => {
    console.log("sw.js: Fail to subscribe system message, error: " + error);
  }
);
*/

self.addEventListener("notificationclick", event => {
  event.notification.close();
});

self.addEventListener('push', function(event) {
    event.waitUntil(
        self.registration.showNotification(
          'My Push', { body: 'Push Activated' }
        )
    );
});

self.addEventListener('activate', e => {
    self.clients.claim();
});

/*
// When the user clicks a notification open the App if it does not exist
onotificationclick = function(event) {
  var found = false;
  clients.matchAll().then(function(clients) {
    for (i = 0; i < clients.length; i++) {
      if (clients[i].url === event.data.url) {
        // do something else involving the matching client
        found = true;
        break;
      }
    }
    if (!found) {
      clients.openApp();
    }
  });
}
*/

function updateTracker1(latitude,longitude) {
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
};

self.onsystemmessage = evt => {
  console.log("Receive systemmessage event with name: " + evt.name);
  console.log(" message data: " + evt.data);
  console.log("  data detail:");
  try {
    console.log(evt.data.json());
  } catch (err) {
    console.log(err);
  }
  updateTracker1(-9,-9);
};

