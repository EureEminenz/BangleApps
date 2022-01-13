//this part needs to be in boot.js!!!

var _GB = global.GB;
global.GB = (event) => {
    // feed a copy to other handlers if there were any
    if (_GB) setTimeout(_GB,0,Object.assign({},event));
    if (event.t=="sleeptracking"){
        print("sleeptracking at SABJS");//Debug
      start_alarm();//TODO
    }
    if (event.t=="notify"){
      print("notify at SABJS");//Debug
    }
    if (event.t=="act"){
      print("act at SABJS");//Debug
        if (typeof event.batch_size== "number"){
            if (event.batch_size==0){
                set_batch_size(1);
            }
            else{
                set_batch_size(event.batch_size);
            }
        }
        if (typeof event.accel=="boolean"){
            if (event.accel){
                if(!movement_tracking_running){
                    
                start_movement_tracking();
                }              
            }
            else{
                stop_movement_tracking();
            }
        }
        if (typeof event.hrm=="boolean"){
            if (event.hrm&&event.accel){
                if(!hr_tracking_running){
                    start_hr_tracking();
                }
                
            }
            else{
                stop_hr_tracking();
            }
        }
    }

};

//variables for accleration data
var max_raw=0;
var current_max_raw_data=0;
var batch_array=[];
var batch_size=0;
var store_interval;
var mag=0;
const G=9.80665;

var movement_tracking_running=false;

var hr_tracking_running=false;
var hr_pause_interval;

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
    if (current_max_raw_data==0){
        current_max_raw_data=G;
    }
    batch_array.push(current_max_raw_data);
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
    //batch_size=12;//standard batch size is 12//should already be set.
    store_interval=setInterval(store_data,10000);//every 10s current max gets stored.
    mag=0;
    Bangle.on('accel', accelHandler);//start listening for acceleration
    
}

function stop_accel_tracking(){
    Bangle.removeListener('accel', accelHandler);//stop listening for acceleration
    if (typeof store_interval!="undefined"){
        clearInterval(store_interval);//stop saving accel_data
        store_interval = undefined;
    }
    
}
//sending intent is com.urbandroid.sleep.watch.START_TRACKING. hr_tracking is bool, default=false
function start_movement_tracking(hr_tracking){
    hr_tracking = (typeof hr_tracking !== 'undefined') ?  hr_tracking : false; //default=false
    movement_tracking_running=true;
    start_accel_tracking();
    if (hr_tracking){
        start_hr_tracking();
    }
}
//sending intent is com.urbandroid.sleep.watch.STOP_TRACKING
function stop_movement_tracking(){
    movement_tracking_running=false;
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
    if (hrm.confidence>80){
        Bangle.setHRMPower(0, "sleepasbanglejs");//stop sensor //TODO replace with Bangle.setHRMPower(false, "sleepasbanglejs"); to prevent other apps from disabeling hrm. Could only be done when in apploader
        pause_hr_tracking(10000);//every 100s start hrm again and see if confidence is still high enough
    }
    //TODO actualy do something with this data
}

function start_hr_tracking(){
    hr_tracking_running=true;
    Bangle.setHRMPower(1, "sleepasbanglejs");//activate sensor //TODO replace with Bangle.setHRMPower(true, "sleepasbanglejs"); to prevent other apps from disabeling hrm. Could only be done when in apploader
    Bangle.on('HRM', hrmHandler);//start listening for hrm data
}

function pause_hr_tracking(ms){
    
    hr_pause_interval=setInterval(start_hr_tracking,ms);//every ms hrm gets restarted
}

function stop_hr_tracking(){
    hr_tracking_running=false;
    Bangle.setHRMPower(0, "sleepasbanglejs");//stop sensor //TODO replace with Bangle.setHRMPower(false, "sleepasbanglejs"); to prevent other apps from disabeling hrm. Could only be done when in apploader
    Bangle.removeListener('HRM', hrmHandler);//stop listening for hrm data
}

/*testcommand
GB({"t":"sleeptracking","id":1592721712,"src":"WhatsApp","title":"Sample Group: Sam","body":"This is a test WhatsApp message"})
GB({"t":"notify","id":1592721712,"src":"WhatsApp","title":"Sample Group: Sam","body":"This is a test WhatsApp message"})
GB({"t":"act","hrm":false,"stp":false,"int":0, "accel":true,"batch_size":12})
actually sent when Sensor_test:
GB({"t":"act","hrm":true,"stp":false,"int":1800,"accel":true,"batch_size":0})
*/
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
