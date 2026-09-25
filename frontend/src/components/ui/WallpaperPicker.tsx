// Shared wallpaper picker — used for both the Lock Screen and Home Screen
// wallpaper accordions. Presets plus a shared gallery of up to 4 performer
// photos (the gallery itself lives one level up, in Setup, so both pickers
// draw from the same uploaded photos instead of each needing its own).
import { Image } from "expo-image";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";

import { Symbol } from "@/src/components/Symbol";
import { WALLPAPER_PRESETS } from "@/src/components/wallpapers";
import { MAX_CUSTOM_WALLPAPERS } from "@/src/engine/customWallpapers";
import { useTheme } from "@/src/theme";

export function WallpaperPicker({
  value,
  onChange,
  customWallpapers,
  onAddPhoto,
  onDeletePhoto,
  error,
  testIDPrefix,
}: {
  value: string;
  onChange: (v: string) => void;
  customWallpapers: string[];
  onAddPhoto: () => void;
  onDeletePhoto: (uri: string) => void;
  error?: string;
  testIDPrefix: string;
}) {
  const { colors } = useTheme();

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 2 }}>
        {WALLPAPER_PRESETS.map((preset) => {
          const active = value === preset.id;
          return (
            <Pressable
              key={preset.id}
              testID={`${testIDPrefix}-${preset.id}`}
              style={{ alignItems: "center", width: 64 }}
              onPress={() => onChange(preset.id)}
            >
              <Image
                source={preset.source}
                style={{
                  width: 56,
                  height: 84,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: active ? colors.brandPrimary : colors.border,
                }}
                contentFit="cover"
              />
              <Text style={{ fontSize: 11, color: active ? colors.brandPrimary : colors.muted, marginTop: 6 }}>
                {preset.name}
              </Text>
            </Pressable>
          );
        })}
        {customWallpapers.map((uri, i) => {
          const active = value === uri;
          return (
            <View key={uri} style={{ alignItems: "center", width: 64 }}>
              <Pressable testID={`${testIDPrefix}-custom-${i}`} onPress={() => onChange(uri)}>
                <Image
                  source={{ uri }}
                  style={{
                    width: 56,
                    height: 84,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: active ? colors.brandPrimary : colors.border,
                  }}
                  contentFit="cover"
                />
                <Pressable
                  testID={`${testIDPrefix}-custom-delete-${i}`}
                  onPress={() => onDeletePhoto(uri)}
                  hitSlop={8}
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: colors.error,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: colors.surfaceSecondary,
                  }}
                >
                  <Symbol name="xmark" fallback="" size={10} color="#FFFFFF" />
                </Pressable>
              </Pressable>
              <Text
                style={{ fontSize: 11, marginTop: 6, color: active ? colors.brandPrimary : colors.muted }}
                numberOfLines={1}
              >
                Photo {i + 1}
              </Text>
            </View>
          );
        })}
        {customWallpapers.length < MAX_CUSTOM_WALLPAPERS && (
          <Pressable testID={`${testIDPrefix}-add-photo`} style={{ alignItems: "center", width: 64 }} onPress={onAddPhoto}>
            <View
              style={{
                width: 56,
                height: 84,
                borderRadius: 10,
                borderWidth: 2,
                borderStyle: "dashed",
                borderColor: colors.border,
                backgroundColor: colors.surfaceTertiary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Symbol name="plus" fallback="" size={22} color={colors.muted} />
            </View>
            <Text style={{ fontSize: 11, marginTop: 6, color: colors.muted }}>Add Photo</Text>
          </Pressable>
        )}
      </ScrollView>
      <Text style={{ fontSize: 11, color: colors.muted, marginTop: 8 }}>
        {customWallpapers.length}/{MAX_CUSTOM_WALLPAPERS} photos in your gallery
      </Text>
      {!!error && (
        <View>
          <Text testID={`${testIDPrefix}-error`} style={{ fontSize: 12, color: colors.error, marginTop: 8 }}>
            {error}
          </Text>
          <Pressable testID={`${testIDPrefix}-open-settings`} onPress={() => Linking.openSettings()} hitSlop={8}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.brandPrimary, marginTop: 6 }}>
              Open Settings
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
