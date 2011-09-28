/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Nightly Tester Tools.
 *
 * The Initial Developer of the Original Code is
 *     Aakash Desai <mozaakash@gmail.com>
 *     Heather Arthur <fayearthur@gmail.com>
 *     Mark Finkle <mark.finkle@gmail.com>
 *     Dave Townsend <dtownsend@mozilla.com>
 *     Matt Brubeck <mbrubeck@mozilla.com>
 *
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var nightly = {

_prefs: [],
_device: "",
_manufacturer: "",

variables: {
  _appInfo: null,
  get appInfo() {
    if (!this._appInfo) {
      this._appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
                                .getService(Components.interfaces.nsIXULAppInfo)
                                .QueryInterface(Components.interfaces.nsIXULRuntime);
    }
    return this._appInfo;
  },

  get appid() this.appInfo.ID,
  get vendor() this.appInfo.vendor,
  get name() this.appInfo.name,
  get version() this.appInfo.version,
  get appbuildid() this.appInfo.appBuildID,
  get platformbuildid() this.appInfo.platformBuildID,
  get platformversion() this.appInfo.platformVersion,
  get geckobuildid() this.appInfo.platformBuildID,
  get geckoversion() this.appInfo.platformVersion,
  brandname: null,
  get useragent() navigator.userAgent,
  get locale() {
    var registry = Components.classes["@mozilla.org/chrome/chrome-registry;1"]
                             .getService(Components.interfaces.nsIXULChromeRegistry);
    return registry.getSelectedLocale("global");
  },
  get os() this.appInfo.OS,
  get processor() this.appInfo.XPCOMABI.split("-")[0],
  get compiler() this.appInfo.XPCOMABI.split("-")[1],
  defaulttitle: null,
  profile: null,
  toolkit: "cairo",
  flags: ""
},

templates: {
},

preferences: null,

init: function() {
  // Activate I/O redirection on Android (bug 586010)
  try {
    Components.utils.import("resource://gre/modules/ctypes.jsm");
    var libdvm = ctypes.open("libdvm.so");
    var dvmStdioConverterStartup = libdvm.declare("dvmStdioConverterStartup",
                                                   ctypes.default_abi,
                                                   ctypes.void_t);
    dvmStdioConverterStartup();
  } catch(e) {
    Components.utils.reportError("ctypes exception: " + e);
  }

  // Delay the widget initialization during startup.
  window.addEventListener("UIReadyDelayed", function(aEvent) {
   
    // A simple frame script to fill in the referrer page and device info
    messageManager.loadFrameScript("chrome://nightly/content/content.js", true);
    
    window.removeEventListener(aEvent.type, arguments.callee, false);
    document.getElementById("nightly-container").hidden = false;
    
    let feedbackPrefs = document.getElementById("nightly-tools").childNodes;
    for (let i =0; i < nightlyPrefs.length; i++) {
      let pref = nightlyPrefs[i].getAttribute("pref");
      if (!pref)
        continue;
      
      let value = Services.prefs.getPrefType(pref) == Ci.nsIPrefBranch.PREF_INVALID ? false : Services.prefs.getBoolPref(pref);
      nightly._prefs.push({"name": pref, "value": value}); 
    }
    
    let sysInfo = Cc["@mozilla.org/system-info;1"].getService(Ci.nsIPropertyBag2);
    nightly._device = sysInfo.get("device");
    nightly._manufacturer = sysInfo.get("manufacturer");
  }, false);

  window.removeEventListener("load", nightly.init, false);
  var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                        .getService(Components.interfaces.nsIPrefService);
  nightly.preferences = prefs.getBranch("nightly.")
                             .QueryInterface(Components.interfaces.nsIPrefBranchInternal);
  nightly.preferences.addObserver("", nightly, false);

  var profd = Components.classes["@mozilla.org/file/directory_service;1"]
                        .getService(Components.interfaces.nsIProperties)
                        .get("ProfD", Components.interfaces.nsILocalFile);
  var profservice = Components.classes["@mozilla.org/toolkit/profile-service;1"]
                              .getService(Components.interfaces.nsIToolkitProfileService);
  var profiles = profservice.profiles;
  
  let nightlyPrefs = document.getElementById("nightly-tools").childNodes;
      for (let i = 0; i < nightlyPrefs.length; i++) {
        let pref = nightlyPrefs[i].getAttribute("pref");
        if (!pref)
          continue;
  
        let value = Services.prefs.getPrefType(pref) == Ci.nsIPrefBranch.PREF_INVALID ? false : Services.prefs.getBoolPref(pref);
        nightly._prefs.push({ "name": pref, "value": value });
      }
  while (profiles.hasMoreElements()) {
    var profile = profiles.getNext().QueryInterface(Components.interfaces.nsIToolkitProfile);
    if (profile.rootDir.path == profd.path) {
      nightly.variables.profile = profile.name;
      break;
    }
  }

  if (!nightly.variables.profile)
    nightly.variables.profile = profd.leafName;

  nightlyApp.init();
  nightly.prefChange("idtitle");

  var lastVersion = 0;
  try {
    lastVersion = nightly.preferences.getCharPref("lastVersion");
    if (lastVersion != "${extension.fullversion}") {
    }
  }
  catch (e) {
    var checkCompatibility = true;
    var checkUpdateSecurity = true;
    if (prefs.prefHasUserValue("extensions.checkCompatibility"))
      checkCompatibility = prefs.getBoolPref("extensions.checkCompatibility");
    if (prefs.prefHasUserValue("extensions.checkUpdateSecurity"))
      checkUpdateSecurity = prefs.getBoolPref("extensions.checkUpdateSecurity");
    if (!checkCompatibility || !checkUpdateSecurity) {
      var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                         .getService(Components.interfaces.nsIWindowMediator);
      var win = wm.getMostRecentWindow("NightlyTester:ConfigWarning");
      if (win) {
        win.focus();
        return;
      }
    
      window.openDialog("chrome://nightly/content/configwarning.xul", "",
                        "dialog=no,titlebar,centerscreen,resizable=no");
    }
  }
  nightly.preferences.setCharPref("lastVersion", "${extension.fullversion}");
},

unload: function(pref) {
  window.removeEventListener("unload",nightly.unload,false);
  nightly.preferences.removeObserver("",nightly);
},

prefChange: function(pref) {
  if ((pref == "idtitle") || (pref == "templates.title")) {
    if (nightly.preferences.getBoolPref("idtitle")) {
      var title = nightly.getTemplate("title");
      if (title && title.length>0)
        nightlyApp.setCustomTitle(nightly.generateText(title));
      else
        nightlyApp.setBlankTitle();
    }
    else {
      nightlyApp.setStandardTitle();
    }
  }
},

observe: function(prefBranch, subject, pref) {
  nightly.prefChange(pref);
},

getStoredItem: function(type, name) {
  name = name.toLowerCase();
  var varvalue = null;
  try {
    return nightly.preferences.getCharPref(type+"."+name);
  }
  catch (e) {}
  return nightly[type][name];
},

getVariable: function(name) {
  return nightly.getStoredItem("variables",name);
},

getTemplate: function(name) {
  return nightly.getStoredItem("templates",name);
},

// Generates the contents of a specified template
generateText: function(template) {
  var start = 0;
  var pos = template.indexOf("${",start);
  while (pos >= 0) {
    if ((pos == 0) || (template.charAt(pos - 1) != "$")) {
      var endpos = template.indexOf("}", pos + 2);
      if (endpos >= 0) {
        var varname = template.substring(pos+2,endpos);
        var varvalue = nightly.getVariable(varname);
        if (varvalue !== null) {
          template = template.substring(0, pos) + varvalue +
                     template.substring(endpos + 1, template.length);
          start = pos + varvalue.length;
        }
        else {
          start = pos + 2;
        }
      }
      else {
        start = pos + 2;
      }
    }
    else {
      start = pos + 2;
    }
    pos = template.indexOf("${", start);
  }
  return template;
},

// Sort list of extensions in alphabetical order
insensitiveSort: function(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  if (a < b)
    return -1
  if (a > b)
    return 1
  // a must be equal to b
  return 0
},

// Grabs the list of extensions on the profile from the AddonsManager jsm module
getExtensionList: function(callback) {
  Components.utils.import("resource://gre/modules/AddonManager.jsm");

  AddonManager.getAllAddons(function(addons) {
    if (!addons.length)
      nightly.showAlert("nightly.noextensions.message", []);

    var strings = addons.map(function(addon) {
      return addon.name + " " + addon.version
        + (addon.userDisabled || addon.appDisabled ? " [DISABLED]" : "");
    });
    strings.sort(nightly.insensitiveSort);
    
    callback(strings.join("\n"));
  });  
},

// Sends the string within the content var within a POST to pastebin.com.
// The browser controls row entry is updated with the status of the request
pastebin: function (content, element) {
  var postdata = "paste_code="+encodeURIComponent(content);
  var request = new XMLHttpRequest();
  request.open("POST", "http://pastebin.com/api_public.php", true);
  request.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
  request.setRequestHeader("Content-length", postdata.length);

  request.onreadystatechange = function() {
    if (request.readyState == 4 && request.status==200) {
      BrowserUI.newTab(request.responseText);
      document.getElementById(element).setAttribute("desc", request.responseText);
    } else {
      document.getElementById(element).setAttribute("desc", "Error:" + request.status + "occurred");
    }
  };
  
  request.send(postdata);
},

pastebinTemplate: function(template, setting) {
  document.getElementById(setting).setAttribute("desc", "sending...");
  
  nightly.pastebin(nightly.generateText(nightly.getTemplate(template)), setting);
},

pastebinExtensions: function(setting) {
  document.getElementById(setting).setAttribute("desc", "sending...");
  
  nightly.getExtensionList(function(text) {
    nightly.pastebin(text, setting);
  });
},

pastebinAboutSupport: function(setting) {
  document.getElementById(setting).setAttribute("desc", "sending...");
  nightly.parseHTML("about:support", function(doc) {
    var contents = doc.getElementById("contents");
    var text = nightlyPPrint.createTextForElement(contents);
    nightly.pastebin(text, setting);
  });
},

parseHTML: function(url, callback) {
  var frame = document.getElementById("sample-frame");
  if (!frame)
    frame = document.createElement("iframe");
 
  frame.setAttribute("id", "sample-frame");
  frame.setAttribute("name", "sample-frame");
  frame.setAttribute("type", "content");
  frame.setAttribute("collapsed", "true");
  document.getElementById("main-window").appendChild(frame);

  frame.addEventListener("load", function (event) {
    var doc = event.originalTarget;
    if (doc.location.href == "about:blank" || doc.defaultView.frameElement)
      return;

    setTimeout(function () {  // give enough time for js to populate page
      callback(doc);
    }, 800);
  }, true);
  frame.contentDocument.location.href = url;
},

// Pops up the restart notification within the Preferences pane
updateRestart: function updateRestart() {
  let msg = document.getElementById("nightly-messages");
  if (msg) {
    let value = "restart-app";
    let notification = msg.getNotificationWithValue(value);
   if (notification) {
      // Check if the pref back to the initial state dismiss the restart
      // notification because it does not make sense anymore
      for each (let pref in this._prefs) {
        let value = Services.prefs.getPrefType(pref.name) == Ci.nsIPrefBranch.PREF_INVALID ? false : Services.prefs.getBoolPref(pref.name);
        if (value == pref.value)
          return;
      }

      notification.close();
      return;
   }

   let restartCallback = function(aNotification, aDescription) {
     // Notify all windows that an application quit has been requested
     let cancelQuit = Cc["@mozilla.org/supports-PRBool;1"].createInstance(Ci.nsISupportsPRBool);
     Services.obs.notifyObservers(cancelQuit, "quit-application-requested", "restart");

     // If nothing aborted, quit the app
     if (cancelQuit.data == false) {
       let appStartup = Cc["@mozilla.org/toolkit/app-startup;1"].getService(Ci.nsIAppStartup);
       appStartup.quit(Ci.nsIAppStartup.eRestart | Ci.nsIAppStartup.eAttemptQuit);
     }
   };

   let strings = Strings.browser;

   let buttons = [ {
     label: strings.GetStringFromName("notificationRestart.button"),
     accessKey: "",
     callback: restartCallback
   } ];
  
   let message = strings.GetStringFromName("notificationRestart.normal");
   msg.appendNotification(message, value, "", msg.PRIORITY_WARNING_LOW, buttons);
  }
},

openFeedback: function(aName) {
  let pref = "nightly.feedback.url." + aName;
  let url = Services.prefs.getPrefType(pref) == Ci.nsIPrefBranch.PREF_INVALID ? "" : Services.prefs.getCharPref(pref);
  if (!url)
    return;

  let currentURL = Browser.selectedBrowser.currentURI.spec;
  let newTab = BrowserUI.newTab(url, Browser.selectedTab);

  // Tell the feedback page to fill in the referrer URL
  newTab.browser.messageManager.addMessageListener("DOMContentLoaded", function() {
    newTab.browser.messageManager.removeMessageListener("DOMContentLoaded", arguments.callee, true);
    newTab.browser.messageManager.sendAsyncMessage("nightly:InitPage", { referrer: currentURL, device: nightly._device, manufacturer: nightly._manufacturer });
  });
}

}

window.addEventListener("load", nightly.init, false);
window.addEventListener("unload", nightly.unload, false);
