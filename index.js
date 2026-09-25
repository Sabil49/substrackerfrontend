// Custom entry point (package.json "main"). Exists purely as a safety net:
// an uncaught JS error during startup makes React Native abort the whole app
// (the "ExceptionsManagerQueue" SIGABRT seen in TestFlight crash logs), which
// leaves no way to see what actually failed. Here we catch it and show it.
//
// This file must stay tiny and dependency-free — it runs before everything else.
const React = require("react");
const { Alert, AppRegistry, ScrollView, Text, View } = require("react-native");

function describe(error) {
  const message = String((error && error.message) || error || "Unknown error");
  const stack = String((error && error.stack) || "");
  return { message, stack };
}

// 1) Errors thrown after startup (timers, event handlers, native callbacks).
// Release builds only, so dev keeps the normal red-box behaviour. The handler
// swallows the fatal flag (so the app stays open) and tells the user what
// happened, once, instead of terminating.
if (!__DEV__ && global.ErrorUtils && global.ErrorUtils.setGlobalHandler) {
  let alerted = false;
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    try {
      console.error("[GlobalError]", isFatal ? "(fatal)" : "", error);
      if (alerted) return;
      alerted = true;
      const { message, stack } = describe(error);
      Alert.alert(
        "Substracker hit an error",
        `${message}\n\n${stack.split("\n").slice(0, 4).join("\n")}`.slice(0, 700),
      );
    } catch (_) {
      // The handler itself must never throw.
    }
  });
}

// 2) Errors thrown while the app's modules load (import-time errors).
// If the real entry throws, register a plain screen that displays the error.
try {
  require("expo-router/entry");
} catch (error) {
  const { message, stack } = describe(error);
  console.error("[StartupError]", error);

  function StartupErrorScreen() {
    return React.createElement(
      View,
      { style: { flex: 1, backgroundColor: "#0B0B10", padding: 24, paddingTop: 80 } },
      React.createElement(
        Text,
        { style: { color: "#FFFFFF", fontSize: 20, fontWeight: "700", marginBottom: 12 } },
        "Substracker couldn't start",
      ),
      React.createElement(
        Text,
        { style: { color: "#C9C9D3", fontSize: 14, marginBottom: 16 } },
        "Please send a screenshot of this screen to support.",
      ),
      React.createElement(
        ScrollView,
        null,
        React.createElement(
          Text,
          { selectable: true, style: { color: "#F87171", fontSize: 13, marginBottom: 12 } },
          message,
        ),
        React.createElement(
          Text,
          { selectable: true, style: { color: "#8B8B99", fontSize: 11 } },
          stack.split("\n").slice(0, 12).join("\n"),
        ),
      ),
    );
  }

  AppRegistry.registerComponent("main", () => StartupErrorScreen);
}
