import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";
import { colors } from "@/constants/theme";
export default function GameListingDummy({ item }: { item: any }) {
  return (
    <LinearGradient
      colors={["#2C2C2F", "#141518"]}
      style={{
        borderRadius: 12,
        paddingHorizontal: 20,
        paddingVertical: 20,
        marginBottom: 20,
      }}
    >
      <Text
        style={{
          color: colors.text.primary,
          fontSize: 24,
          fontFamily: "Poppins-SemiBold",
          letterSpacing: -0.8,
        }}
      >
        {item.courseName}
      </Text>
      <View
        style={{ flexDirection: "row", alignItems: "center"}}
      >
        <Text
          style={{
            color: colors.primary.yellow,
            fontSize: 16,
            fontFamily: "Poppins-Regular",
          }}
        >
          {item.date}
        </Text>
        <Text
          style={{
            color: colors.text.secondary,
            marginLeft: 8,
            fontSize: 16,
            fontFamily: "Poppins-Light",
          }}
        >
          {item.gameType}
        </Text>
      </View>
      <View
        style={{
          backgroundColor:
            item.matchType === "Competitive Match" ? "#442222" : "#443311",
          borderColor:
            item.matchType === "Competitive Match" ? "#E23642" : "#F78222",
          borderWidth: 1,
          alignSelf: "flex-start",
          paddingHorizontal: 12,
          paddingVertical: 4,
          borderRadius: 16,
          marginTop: 8,
        }}
      >
        <Text
          style={{
            color: colors.text.primary,
            fontSize: 12,
            fontFamily: "Poppins-Regular",
          }}
        >
          {item.matchType}
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 20,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            style={{
              color: colors.text.primary,
              fontSize: 12,
              fontFamily: "Poppins-Regular",
            }}
          >
            {item.players.current}/{item.players.total} Players
          </Text>
        </View>
        <Text
          style={{
            color: colors.text.primary,
            fontSize: 12,
            fontFamily: "Poppins-Regular",
          }}
        >
          {item.timeSlot}
        </Text>
      </View>

      <View
        style={{
          height: 1,
          backgroundColor: colors.text.secondary,
          marginBottom: 16,
          marginTop: 12,
          width: "100%",
        }}
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: 'space-between',
          marginTop: 0,
          gap: 8, // Space between player slots
        }}
      >
        <PlayerSlot filled={true} name="Steven" />
        <PlayerSlot filled={false} name="" />
        <PlayerSlot filled={false} name="" />
        <PlayerSlot filled={false} name="" />
      </View>
    </LinearGradient>
  );
}

const PlayerSlot = ({ filled, name = "" }: { filled: boolean, name: string } ) => {
  return (
    <View style={{ alignItems: "center", width: 60 }}>
      {filled ? (
        <View
          style={{
            width: 54,
            height: 54,
            borderRadius: 50,
            backgroundColor: "#444", // Adjust color as needed
            marginBottom: 10,
          }}
        />
      ) : (
        <View
          style={{
            width: 54,
            height: 54,
            borderRadius: 50,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: colors.text.secondary,
            marginBottom: 10,
          }}
        />
      )}
      <Text
        style={{
          color: filled ? colors.text.primary : colors.text.secondary,
        }}
      >
        {filled ? name : "Open"}
      </Text>
    </View>
  );
};

