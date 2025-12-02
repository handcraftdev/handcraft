// Re-export Tamagui config
export { config } from "./tamagui.config";
export type { AppConfig } from "./tamagui.config";

// Re-export Tamagui primitives for convenience
export {
  styled,
  Stack,
  XStack,
  YStack,
  Text,
  Paragraph,
  H1,
  H2,
  H3,
  H4,
  H5,
  H6,
  Separator,
  Spacer,
  ScrollView,
  Image,
  Input,
  TextArea,
  Label,
  Switch,
  Checkbox,
  RadioGroup,
  Select,
  Slider,
  Progress,
  Spinner,
  Avatar,
  Card,
  Sheet,
  Dialog,
  Popover,
  Tooltip,
  Tabs,
  Accordion,
} from "tamagui";

// Re-export custom components
export * from "./button";
export * from "./utils";
