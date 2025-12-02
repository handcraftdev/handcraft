import { styled, GetProps, Stack, Spinner } from "tamagui";

export const Button = styled(Stack, {
  name: "Button",
  tag: "button",
  role: "button",
  focusable: true,

  // Base styles
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "$4",
  paddingHorizontal: "$4",
  paddingVertical: "$2",
  gap: "$2",
  cursor: "pointer",
  userSelect: "none",

  // Animation
  animation: "fast",

  // Hover/Press states
  hoverStyle: {
    opacity: 0.9,
  },
  pressStyle: {
    opacity: 0.8,
    scale: 0.98,
  },
  focusStyle: {
    outlineWidth: 2,
    outlineColor: "$primary500",
    outlineStyle: "solid",
    outlineOffset: 2,
  },

  // Disabled state
  disabledStyle: {
    opacity: 0.5,
    cursor: "not-allowed",
  },

  variants: {
    variant: {
      default: {
        backgroundColor: "$primary600",
        color: "$white",
        hoverStyle: {
          backgroundColor: "$primary700",
        },
      },
      secondary: {
        backgroundColor: "$gray8",
        color: "$white",
        hoverStyle: {
          backgroundColor: "$gray7",
        },
      },
      outline: {
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: "$gray7",
        color: "$gray12",
        hoverStyle: {
          backgroundColor: "$gray3",
        },
      },
      ghost: {
        backgroundColor: "transparent",
        color: "$gray12",
        hoverStyle: {
          backgroundColor: "$gray3",
        },
      },
      destructive: {
        backgroundColor: "$red9",
        color: "$white",
        hoverStyle: {
          backgroundColor: "$red10",
        },
      },
    },
    size: {
      sm: {
        height: 32,
        paddingHorizontal: "$3",
        fontSize: "$2",
      },
      md: {
        height: 40,
        paddingHorizontal: "$4",
        fontSize: "$3",
      },
      lg: {
        height: 48,
        paddingHorizontal: "$5",
        fontSize: "$4",
      },
      icon: {
        width: 40,
        height: 40,
        padding: 0,
      },
    },
    fullWidth: {
      true: {
        width: "100%",
      },
    },
  } as const,

  defaultVariants: {
    variant: "default",
    size: "md",
  },
});

export type ButtonProps = GetProps<typeof Button> & {
  isLoading?: boolean;
};

// Button with loading state wrapper
export function ButtonWithLoading({
  isLoading,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <Button disabled={disabled || isLoading} {...props}>
      {isLoading && <Spinner size="small" color="$color" />}
      {children}
    </Button>
  );
}
