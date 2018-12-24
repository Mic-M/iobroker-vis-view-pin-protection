/*******************************************************************************
 * ---------------------------
 * Pin-Schutz für VIS-View
 * ---------------------------
 * Autor: Mic
 * Change Log
 *  - 0.2 - Fix: 0 on keypad was not recognized
 *  - 0.1 - initial version
 * Support: https://forum.iobroker.net/viewtopic.php?f=30&t=19871
 ******************************************************************************/

/*******************************************************************************
 * Konfiguration
 ******************************************************************************/
const STATE_PATH = 'javascript.' + instance + '.' + 'visViewPinSperre.';

const LOGGING = true;         // Detaillierte Ausgabe im Log. Falls keine Probleme, dann auf false setzen.


/*******************************************************************************
 * Konfiguration: Views
 ******************************************************************************/
// Es können beliebig mehr Views hinzugefügt oder auf eine limitiert werden, bitte aber Aufbau beibehalten!
const PIN_VIEWS = [
  {
    name:       'pSet_1',        // Name der View, zu der bei Erfolg gewechselt werden soll
    project:    'M3',            // VIS-Projekt, in dem die View ist, für den Viewwechsel bei Erfolg. Wert bekommt man u.a.: Vis -> Menü: Setup > Projekte (den Namen des jeweilgen Projektes nehmen)
    instance:   'FFFFFFFF',      // Funktioniert bei mir (und einigen anderen) immer mit 'FFFFFFFF', ansonsten Wert vom Vis, Menü Tools, Feld "Instanz ID" nehmen
    pin:        '1234',          // Pin
  },
  {
    name:       'Test',          
    project:    'Testprojekt',   
    instance:   'FFFFFFFF',      
    pin:        '5678',          
  },
];


/**********************************************************************************************************
 ++++++++++++++++++++++++++++ Ab hier nichts mehr ändern / Stop editing here! ++++++++++++++++++++++++++++
 *********************************************************************************************************/


/*******************************************************************************
 * Globale Variablen
 *******************************************************************************/
// Array, pro View ein Element
var G_LastKeyPressed = [];      // Letzte Taste, die gedrückt wurde
var G_PinBufferKeys = [];       // Puffer für eingegebene Ziffern
var G_PinBufferWildcards = [];  // Für Vis-Anzeigefeld der Pineingabe, füllt sich mit "*" nach jeder Zifferneingabe

/*******************************************************************************
 * Executed on every script start.
 *******************************************************************************/
init();
function init() {
 
    // Create states
    createScriptStates();

    // 1. Initialize global variables
    // 2. Reset for each view
    setTimeout(function(){
        for (let i = 0; i < PIN_VIEWS.length; i++) {
            // Initialize global variables
            G_LastKeyPressed[PIN_VIEWS[i].name] = '';
            G_PinBufferKeys[PIN_VIEWS[i].name] = '';
            G_PinBufferWildcards[PIN_VIEWS[i].name] = '';        
            // Reset für jede View durchführen
            resetPin(PIN_VIEWS[i].name)
        }
    }, 3000);

    // Main Script starten, 5 Sekunden nach State-Generierung
    setTimeout(main, 5000);

}

/*******************************************************************************
 * Haupt-Skript
 *******************************************************************************/
function main() {

    // Überwacht das Tastenfeld in VIS für jede View
    for (var i = 0; i < PIN_VIEWS.length; i++) {
        on({id: STATE_PATH + PIN_VIEWS[i].name + '.CurrentKey', change: "any"}, function (obj) {
            var currView = obj.id.substr(STATE_PATH.length).split(".")[0]; // get View Name simply from obj.id
            if(LOGGING) if(obj.state.val != '') log('Eingabe über Tastenfeld: ' + obj.state.val + ', Viewname: ' + currView);
            switch(obj.state.val) {
                case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7: case 8: case 9:
                    G_LastKeyPressed[currView] = obj.state.val;
                    userEnteredNumber(currView);
                    break;
                case 'Enter':   // Der User hat die Pin-Eingabe bestätigt.
                    checkEnteredPin(currView);
                    break;
                case 'Reset':
                    resetPin(currView);
                    break;
                default:
                    //None
            } 
        });
    }

}


/********************************
 * Create States
 ********************************/
function createScriptStates() {
    for (let i = 0; i < PIN_VIEWS.length; i++) {
        createState(STATE_PATH + PIN_VIEWS[i].name + '.CurrentKey', {'name':'Mit Tasten aus VIS setzen', 'type':'string', 'read':true, 'write':false, 'role':'info', 'def':'' });
        createState(STATE_PATH + PIN_VIEWS[i].name + '.WrongPinEntered', {'name':'Pin-Fehler', 'type':'boolean', 'read':true, 'write':false, 'role':'info'});
        createState(STATE_PATH + PIN_VIEWS[i].name + '.PinWildcards', {'name':'Sterne (*) für VIS-Anzeige', 'type':'string', 'read':true, 'write':false, 'role':'info', 'def':'' });
    }
}


/********************************
 * Wird ausgeführt, sobald der User eine Nummer im Tastenfeld eingibt.
 * @param {string}   viewName     Name der View
 *********************************/
function userEnteredNumber(viewName) {
    G_PinBufferKeys[viewName] = G_PinBufferKeys[viewName] + G_LastKeyPressed[viewName];
    G_PinBufferWildcards[viewName] = G_PinBufferWildcards[viewName] + ' *';
    setState(STATE_PATH + viewName + '.PinWildcards', G_PinBufferWildcards[viewName]);
}

/********************************
 * Wird ausgeführt, sobald der User E für "Enter" eingibt
 * @param {string}   viewName     Name der View
 ********************************/
function checkEnteredPin(viewName) {
    if (G_PinBufferKeys[viewName] == getPresetElement(viewName, 'pin')) {
        if(LOGGING) log('Pin-Eingabe erfolgreich, View [' + viewName + ']');
        onSuccess(viewName);
        setTimeout(function() { resetPin(viewName) }, 3000);    // Reset nach 3 Sekunden
    } else {
        if(LOGGING) log('Falschen Pin eingegeben, View [' + viewName + ']');
        setState(STATE_PATH + viewName + '.WrongPinEntered', true);
        resetPin(viewName);
    }
}    

/********************************
 * Reset
 * @param {string}   viewName     Name der View
 ********************************/
function resetPin(viewName) {
    if(LOGGING) log('Reset Pin, View-Name: [' + viewName + ']');
    G_PinBufferWildcards[viewName] = '';
    G_PinBufferKeys[viewName] = '';
    setState(STATE_PATH + viewName + '.CurrentKey', '');
    setState(STATE_PATH + viewName + '.PinWildcards', '');
    setStateDelayed(STATE_PATH + viewName + '.WrongPinEntered', false, 3000); // Erst nach 3 Sekunden, für VIS-Anzeige
}

/********************************
 * Wird bei erfolgreicher Pin-Eingabe ausgeführt
 * @param {string}   viewName     Name der View
 ********************************/
function onSuccess(viewName){
    // Change View
    setState("vis.0.control.instance", getPresetElement(viewName, 'instance'));
    setState("vis.0.control.data",     getPresetElement(viewName, 'project') + '/' + viewName);
    setState("vis.0.control.command",  'changeView');
}


/********************************
 * Gibt Elemente von PIN_VIEWS zurück
 * @param {string}   viewName     Name of the view
 * @param {string}   key          'project', 'instance', 'pin'
 * @return {string}  Content of the element, e.g. the Pin "1234" for element 'pin'
 ********************************/
function getPresetElement(viewName, key) {
    var keyEntry = '';
    for (let i = 0; i < PIN_VIEWS.length; i++) {
        if (PIN_VIEWS[i].name === viewName) {
            keyEntry = PIN_VIEWS[i][key]
        }
    }
    return keyEntry;
}
