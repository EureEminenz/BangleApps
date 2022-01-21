//this part needs to be in boot.js!!!
(function(){
    var _GB = global.GB;
    global.GB = (event) => {
        // feed a copy to other handlers if there were any
        if (_GB) setTimeout(_GB,0,Object.assign({},event));
        if (event.t=="sleeptracking"){
            print("sleeptracking at SABJS");//Debug
        startAlarm();//TODO
        }
        if (event.t=="notify"){
        //print("notify at SABJS");//Debug
        }
        if (event.t=="act"){
        //print("act at SABJS");//Debug
            if (typeof event.batch_size== "number"){
                if (event.batch_size==0){
                    setBatchSize(1);
                }
                else{
                    setBatchSize(event.batch_size);
                }
            }
            if (typeof event.accel=="boolean"){
                if (event.accel){
                    if(!movementTrackingRunning){
                    startMovementTracking();
                    }
                }
                else{
                    stopMovementTracking();
                }
            }
            if (typeof event.hrm=="boolean"){
                if (event.hrm&&event.accel){
                    if(!hrTrackingRunning){
                        startHrTracking();
                    }
                }
                else{
                    stopHrTracking();
                }
            }
        }

    };

    //debug
    var boot=false;

    //variables for accleration data
    var maxRaw=0;
    var currentMaxRawData=0;
    var batchArray=[];
    var batchSize=0;
    var storeInterval;
    var mag=0;
    const G=9.80665;

    var movementTrackingRunning=false;

    var hrTrackingRunning=false;
    var hrPauseInterval;

    //variables for vibration
    var vibrationInterval;

    //variables for display
    var brightness=0;
    var undimmTime=10000;//in ms
    var undimmSteps=100;
    var undimmInterval;
    var optionsLcdTimeout;//in ms



    //saves currentMaxRawData to array, checks for reach of batchSize. If reached, sendBatch() is triggered
    function storeData(){
        if (currentMaxRawData==0){
            currentMaxRawData=G;
        }
        batchArray.push(currentMaxRawData.toFixed(2));
        currentMaxRawData=0;
        if (batchArray.length>=batchSize){
        sendBatch();
        }
    }
    //sends batch via bluetooth. recieving intent is com.urbandroid.sleep.watch.DATA_UPDATE
    function sendBatch(){
        //print("Batch sent");
        Bluetooth.println(JSON.stringify({t:"accel_batch", batch:batchArray}));
        batchArray=[];
    }
    //sets batchSize. expected is len(batch). Sending intent is com.urbandroid.sleep.watch.SET_BATCH_SIZE
    function setBatchSize(newsize){
        batchSize=newsize;
    }
    //accel.mag is geometric average in G. gets converted to m/s². Only max gets saved.
    function accelHandler(accel){
        maxRaw=accel.mag*G;
        if (maxRaw > currentMaxRawData) {
            currentMaxRawData = maxRaw;
        }
        //Debug
    //print("accel");
    }

    //initializing variables for accel_tracking. 
    function startAccelTracking(){
        maxRaw=0;
        currentMaxRawData=0;
        batchArray=[];
        storeInterval=setInterval(storeData,10000);
        mag=0;
        Bangle.on('accel', accelHandler);
    }

    function stopAccelTracking(){
        Bangle.removeListener('accel', accelHandler);
        if (typeof storeInterval!="undefined"){
            clearInterval(storeInterval);
            storeInterval = undefined;
        }
    }
    //sending intent is com.urbandroid.sleep.watch.START_TRACKING. hrTracking is bool, default=false
    function startMovementTracking(hrTracking){
        hrTracking = (typeof hrTracking !== 'undefined') ?  hrTracking : false;
        movementTrackingRunning=true;
        startAccelTracking();
        if (hrTracking){
            startHrTracking();
        }
    }
    //sending intent is com.urbandroid.sleep.watch.STOP_TRACKING
    function stopMovementTracking(){
        movementTrackingRunning=false;
        stopAccelTracking();
        stopHrTracking();
    }

    //sending intent is com.urbandroid.sleep.watch.START_ALARM. delay is optional and in ms
    function startAlarm(delay){
        optionsLcdTimeout=Bangle.getOptions().backlightTimeout;
        delay = (typeof delay !== 'undefined') ?  delay : 0;
        setTimeout(setVibrateInterval, delay);
        setTimeout(showAlarm, delay);
    }

    //show alarm on watch with options do snooz and dismiss
    function showAlarm(){
        Bangle.setLCDBrightness(0);
        Bangle.setLCDPower(1);
        startUndimm();
        Bangle.setLCDTimeout(30);
        Bangle.setLocked(false);
        E.showPrompt("Alert",{//LANG
        title:"Alert",//LANG
        buttons : {"snooze":"snooze","dismiss":"dismiss"} //LANG
        }).then(function(v) {
            switch(v){
                case "snooze":{
                    snoozeFromWatch();
                    break;
                }
                case "dismiss":{
                    dismissFromWatch();
                    break;
                }
            }
        });
    }

    function undimmLcd(){
        Bangle.setLCDBrightness(brightness);
        print(brightness);
        if (brightness>=1){
            print("max");
            resetUndimmInterval();
        }
        brightness+=1/undimmSteps;
    }
    function startUndimm(){
        undimmInterval=setInterval(undimmLcd,undimmTime/undimmSteps);
    }

    //receiving intent is com.urbandroid.sleep.watch.SNOOZE_FROM_WATCH
    function snoozeFromWatch(){
        print("snooze");//debug
    }
    //recieving intent is com.urbandroid.sleep.watch.DISMISS_FROM_WATCH
    function dismissFromWatch(){
        print("dismiss");//debug
    }
    //vibrate in given interval, defaul=1000ms
    function setVibrateInterval(interval){
        interval = (typeof interval !== 'undefined') ?  interval : 1000; //default=1s
        vibrationInterval=setInterval(function(){Bangle.buzz();},interval);
    }

    function resetUndimmInterval(){
        if(typeof undimmInterval!=='undefined'){
            clearInterval(undimmInterval);
            undimmInterval=undefined;
            brightness=0;
        }
    }
    //sending intent is com.urbandroid.sleep.watch.STOP_ALARM
    function stopAlarm(){
        clearInterval(vibrationInterval);
        vibrationInterval = undefined;
        resetUndimmInterval();
        Bangle.setLCDTimeout(optionsLcdTimeout/1000);
    }

    //every 100s start hrm again and see if confidence is still high enough
    function hrmHandler(hrm){
        if (hrm.confidence>80){
            if (boot){
                Bangle.setHRMPower(0, "sleepasbanglejs");
            }
            else{
                Bangle.setHRMPower(0);
            }
            pauseHrTracking(10000);
        }
        //TODO actualy do something with this data
    }

    //start listening for hrm data
    function startHrTracking(){
        hrTrackingRunning=true;
        if (boot){
            Bangle.setHRMPower(1, "sleepasbanglejs");
        }
        else{
            Bangle.setHRMPower(1);
        }
        Bangle.on('HRM', hrmHandler);
    }

    //every ms hrm gets restarted
    function pauseHrTracking(ms){    
        hrPauseInterval=setInterval(startHrTracking,ms);
    }

    //stop listening for hrm data
    function stopHrTracking(){
        hrTrackingRunning=false;
        if (boot){
            Bangle.setHRMPower(0, "sleepasbanglejs");
        }
        else{
            Bangle.setHRMPower(0);
        }
        Bangle.removeListener('HRM', hrmHandler);
    }
})();

/*testcommand
GB({"t":"sleeptracking","id":1592721712,"src":"WhatsApp","title":"Sample Group: Sam","body":"This is a test WhatsApp message"})
GB({"t":"notify","id":1592721712,"src":"WhatsApp","title":"Sample Group: Sam","body":"This is a test WhatsApp message"})
GB({"t":"act","hrm":false,"stp":false,"int":0, "accel":true,"batch_size":12})
actually sent when Sensor_test:
GB({"t":"act","hrm":true,"stp":false,"int":1800,"accel":true,"batch_size":0})
*/
/*TODO
 * Logging
 * Return Values from startMovementTracking and stopMovementTracking
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
