import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import "./global.css";

export default function RootLayout() {
  return (
    <SafeAreaView>
      <View style={{ padding: 20 }}>
        <Text>Welcome jee</Text>
        <TextInput placeholder="Enter text here" />
        <TouchableOpacity
          style={{
            backgroundColor: "#2563EB",
            padding: 12,
            borderRadius: 8,
            marginTop: 10,
            alignItems: "center",
          }}
        >
          <Text>Search</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
