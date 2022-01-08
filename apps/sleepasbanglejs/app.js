exports.pushMessage = function(event) {
    print("recieved");
}

//variables for accleration data
var max_raw=0;
var current_max_raw_data=0;
var batch_array=[];
var batch_size=0;
var store_interval;
var mag=0;
const G=9.80665;

//variables for vibration
var vibration_interval;

//variables for display
var brightness=0;
var undimm_time=10000;//in ms
var undimm_steps=100;
var undimm_interval;
var options_lcdtimeout;//in ms

//saves current_max_raw_data to array, checks for reach of batch_size. If reached, send_batch() is triggered
function store_data(){
    print(current_max_raw_data);//Debug
    batch_array.push(current_max_raw_data);
    print(batch_array);//Debug
    current_max_raw_data=0;
    if (batch_array.length>=batch_size){
      send_batch();
    }
}
//sends batch via bluetooth. recieving intent is com.urbandroid.sleep.watch.DATA_UPDATE
function send_batch(){
    print("Batch sent");
    Bluetooth.println(JSON.stringify({t:"accel_batch", batch:batch_array}));
    batch_array=[];
}
//sets batch_size. expected is len(batch). Sending intent is com.urbandroid.sleep.watch.SET_BATCH_SIZE
function set_batch_size(newsize){
    batch_size=newsize;
}
//accel.mag is geometric average in G. gets converted to m/s². Only max gets saved.
function accelHandler(accel){
    max_raw=accel.mag*G;
    if (max_raw > current_max_raw_data) {
        current_max_raw_data = max_raw;
    }
    //Debug
  //print("accel");

}

//initializing variables for accel_tracking. 
function start_accel_tracking(){
    max_raw=0;
    current_max_raw_data=0;
    batch_array=[];
    batch_size=12;//standard batch size is 12
    store_interval=setInterval(store_data,10000);//every 10s current max gets stored.
    mag=0;
    Bangle.on('accel', accelHandler);//start listening for acceleration
    
}

function stop_accel_tracking(){
    Bangle.removeListener('accel', accelHandler);//stop listening for acceleration
    clearInterval(store_interval);//stop saving accel_data
    store_interval = undefined;
    
}
//sending intent is com.urbandroid.sleep.watch.START_TRACKING. hr_tracking is bool, default=false
function start_movement_tracking(hr_tracking){
    hr_tracking = (typeof hr_tracking !== 'undefined') ?  hr_tracking : false; //default=false
    start_accel_tracking();
    if (hr_tracking){
        start_hr_tracking();
    }
}
//sending intent is com.urbandroid.sleep.watch.STOP_TRACKING
function stop_movement_tracking(){
    stop_accel_tracking();
    stop_hr_tracking();
}

//sending intent is com.urbandroid.sleep.watch.START_ALARM. delay is optional and in ms
function start_alarm(delay){
    options_lcdtimeout=Bangle.getOptions().backlightTimeout; //store options value for later reset
    delay = (typeof delay !== 'undefined') ?  delay : 0; //if not defined, delay should be 0
    setTimeout(set_vibrate_interval, delay);
    setTimeout(show_alarm, delay);
}

//show alarm on watch with options do snooz and dismiss
function show_alarm(){
    Bangle.setLCDBrightness(0);
    Bangle.setLCDPower(1);//power on Display
    start_undimm();
    Bangle.setLCDTimeout(30);//set Timeout to 30s
    Bangle.setLocked(false);//unlock screen
    E.showPrompt("Alert",{//LANG
    title:"Alert",//LANG
    buttons : {"snooze":"snooze","dismiss":"dismiss"} //LANG
    }).then(function(v) {
        switch(v){
            case "snooze":{
                snooze_from_watch();
                break;
            }
            case "dismiss":{
                dismiss_from_watch();
                break;
            }
        }
    });
}

function undimm_lcd(){
    
    Bangle.setLCDBrightness(brightness);
    print(brightness);
    if (brightness>=1){
        print("max");
        reset_undimm_interval();
    }
    brightness+=1/undimm_steps;
}
function start_undimm(){
    undimm_interval=setInterval(undimm_lcd,undimm_time/undimm_steps);
}

//receiving intent is com.urbandroid.sleep.watch.SNOOZE_FROM_WATCH
function snooze_from_watch(){
    print("snooze");//debug
}
//recieving intent is com.urbandroid.sleep.watch.DISMISS_FROM_WATCH
function dismiss_from_watch(){
    print("dismiss");//debug
}
//vibrate in given interval, defaul=1000ms
function set_vibrate_interval(interval){
    interval = (typeof interval !== 'undefined') ?  interval : 1000; //default=1s
    vibration_interval=setInterval(function(){Bangle.buzz();},interval);
}

function reset_undimm_interval(){
    if(typeof undimm_interval!=='undefined'){
        clearInterval(undimm_interval);
        undimm_interval=undefined;
        brightness=0;
    }
}
//sending intent is com.urbandroid.sleep.watch.STOP_ALARM
function stop_alarm(){
    clearInterval(vibration_interval);
    vibration_interval = undefined;
    reset_undimm_interval();
    Bangle.setLCDTimeout(options_lcdtimeout/1000);//restore saved values and convert from ms to s
}

function hrmHandler(hrm){
    print(hrm);//Debug
    //TODO actualy do something with this data
}

function start_hr_tracking(){
    Bangle.setHRMPower(1);//activate sensor //TODO replace with Bangle.setHRMPower(true, "sleepasbanglejs"); to prevent other apps from disabeling hrm. Could only be done when in apploader
    Bangle.on('HRM', hrmHandler);//start listening for hrm data
}

function stop_hr_tracking(){
    Bangle.setHRMPower(0);//stop sensor //TODO replace with Bangle.setHRMPower(false, "sleepasbanglejs"); to prevent other apps from disabeling hrm. Could only be done when in apploader
    Bangle.removeListener('HRM', hrmHandler);//stop listening for hrm data
}

/*TODO
 * Logging
 * Return Values from start_movement_tracking and stop_movement_tracking
 * Make vibration more gentle, perhaps taking into account brightness value. Therefor should rename brightness to intensity
*/
/* TODO Commands from SleepAsAndroid
funtion set_alarm(){
}
function pause_tracking(){
}
function suspend_tracking(){
}


*/

/*Optional Commands from SleepAsAndroid
function show_notification(){
}
function vibrate_on_hint(){
}
*/

/* TODO Commands from Watch
function send_hr_data(){
}
*/

/*Optional Commands from Watch
function pause_from_watch(){
}
function resume_from_watch(){
}

*/
