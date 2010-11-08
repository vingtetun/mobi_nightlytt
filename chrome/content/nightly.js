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

copyText: function(text) {
  var clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"].
                                         getService(Components.interfaces.nsIClipboardHelper);
  clipboard.copyString(text);
},

copyTemplate: function(template) {
  nightly.copyText(nightly.generateText(nightly.getTemplate(template)));
},

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

insertExtensions: function() {
  var element = document.commandDispatcher.focusedElement;
  if (element) {
    var type = element.localName.toLowerCase();
    if ((type == "input") || (type == "textarea")) {
      nightly.getExtensionList(function(text) {
        var newpos = element.selectionStart + text.length;
        var value = element.value;
        element.value = value.substring(0, element.selectionStart) + text +
                        value.substring(element.selectionEnd);
        element.selectionStart = newpos;
        element.selectionEnd = newpos;
      });
      return;
    }
  }
  nightly.showAlert("nightly.notextbox.message",[]);
},

copyExtensions: function() {
  nightly.getExtensionList(function(text) {
    if (text)
      nightly.copyText(text);
  });
},

updateRestart: function updateRestart() {
  let msg = document.getElementById("nightly-messages");
  if (msg) {
    let strings = Elements.browserBundle;

    let value = "restart-app";
    let notification = msg.getNotificationWithValue(value);
    if (notification)
      return;

    let restartCallback = function(aNotification, aDescription) {
      // Notify all windows that an application quit has been requested
      var cancelQuit = Cc["@mozilla.org/supports-PRBool;1"].createInstance(Ci.nsISupportsPRBool);
      Services.obs.notifyObservers(cancelQuit, "quit-application-requested", "restart");

      // If nothing aborted, quit the app
      if (cancelQuit.data == false) {
        let appStartup = Cc["@mozilla.org/toolkit/app-startup;1"].getService(Ci.nsIAppStartup);
        appStartup.quit(Ci.nsIAppStartup.eRestart | Ci.nsIAppStartup.eAttemptQuit);
      }
    };

    let buttons = [ {
      label: strings.getString("notificationRestart.button"),
      accessKey: "",
      callback: restartCallback
    } ];

    let message = strings.getString("notificationRestart.normal");
    msg.appendNotification(message, value, "", msg.PRIORITY_WARNING_LOW, buttons);
  }
}
}

window.addEventListener("load", nightly.init, false);
window.addEventListener("unload", nightly.unload, false);
