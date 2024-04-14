module.exports = {
  purge: {
    content: ['./public/**/*.{html,js,mjs}', './src/**/*.{js,jsx,ts,tsx}'],
    options: {
      whitelistPatterns: [/popper/, /tippy/, /BrainhubCarousel/],
      whitelistPatternsChildren: [/popper/, /tippy/, /BrainhubCarousel/]
    }
  },
  prefix: '',
  important: false,
  separator: ':',
  theme: {
    screens: {
      xxs: '440px',
      xxsPlus: '536px',
      xs: '600px',
      sm: '632px',
      md: '768px',
      lg: '1024px',
      xl: '1280px'
    },
    colors: (() => {
      /**
       * Base colors
       */
      const baseColors = {
        transparent: 'transparent',
        current: 'currentColor',

        black: '#000',
        cleanWhite: '#fff',
        white: '#F4F4F4',
        divider: '#333333',

        gray: {
          10: '#f4f4f4',
          15: '#E6E6E6',
          20: '#aeaeb2',
          30: '#AAA',
          40: '#666',
          50: '#44494A',
          100: '#f7fafc',
          200: '#edf2f7',
          300: '#e2e8f0',
          350: '#d8e0e8',
          400: '#cbd5e0',
          405: '#DFDFE0',
          410: '#DCDAFF',

          500: '#a0aec0',
          600: '#718096',
          700: '#4a5568',
          710: '#323232',
          800: '#2d3748',
          850: '#212e36',
          890: '#292929',
          900: '#202020',
          910: '#171717',
          920: '#010101'
        },
        red: {
          100: '#fff5f5',
          200: '#fed7d7',
          300: '#feb2b2',
          400: '#fc8181',
          500: '#f56565',
          600: '#e53e3e',
          700: '#DB0505',
          800: '#9b2c2c',
          900: '#742a2a'
        },
        orange: {
          10: '#fff2e6',
          20: '#ff5b00',
          100: '#fffaf0',
          200: '#feebc8',
          300: '#fbd38d',
          400: '#E68226',
          500: '#ed8936',
          600: '#F86412',
          700: '#c05621',
          800: '#9c4221',
          900: '#7b341e'
        },
        yellow: {
          100: '#fffff0',
          200: '#fefcbf',
          300: '#faf089',
          400: '#f6e05e',
          500: '#ecc94b',
          600: '#d69e2e',
          700: '#b7791f',
          800: '#975a16',
          900: '#744210'
        },
        green: {
          100: '#f0fff4',
          200: '#c6f6d5',
          300: '#9ae6b4',
          400: '#68d391',
          500: '#48bb78',
          600: '#38a169',
          700: '#2f855a',
          800: '#276749',
          900: '#22543d',
          910: '#00B71D'
        },
        teal: {
          100: '#e6fffa',
          200: '#b2f5ea',
          300: '#81e6d9',
          400: '#4fd1c5',
          500: '#38b2ac',
          600: '#319795',
          700: '#2c7a7b',
          800: '#285e61',
          900: '#234e52'
        },
        blue: {
          50: '#e8f1fd',
          100: '#ebf8ff',
          150: '#E5F2FF',
          200: '#B9EEFE',
          300: '#90cdf4',
          400: '#63b3ed',
          500: '#4299e1',
          600: '#3182ce',
          650: '#007AFF',
          700: '#2b6cb0',
          750: '#4a5568',
          800: '#2c5282',
          900: '#2a4365',
          910: '#212e36'
        },
        indigo: {
          100: '#ebf4ff',
          200: '#c3dafe',
          300: '#a3bffa',
          400: '#7f9cf5',
          500: '#667eea',
          600: '#5a67d8',
          700: '#5F58FF',
          800: '#434190',
          900: '#3c366b'
        },
        purple: {
          100: '#faf5ff',
          200: '#e9d8fd',
          300: '#d6bcfa',
          400: '#b794f4',
          500: '#9f7aea',
          600: '#805ad5',
          700: '#6b46c1',
          800: '#553c9a',
          900: '#44337a'
        },
        pink: {
          100: '#fff5f7',
          200: '#fed7e2',
          300: '#fbb6ce',
          400: '#f687b3',
          500: '#ed64a6',
          600: '#d53f8c',
          700: '#b83280',
          800: '#97266d',
          900: '#702459'
        }
      };

      /**
       * Brand colors
       */
      const brandColors = {
        'primary-white': '#F4F4F4',
        'secondary-white': baseColors.gray[30],
        'accent-blue': baseColors.indigo[700],
        'accent-blue-hover': 'rgba(95, 88, 255, 0.25)',
        'primary-link': baseColors.teal[200],
        'primary-card': baseColors.gray[900],
        'primary-card-hover': baseColors.gray[890],
        'secondary-card': baseColors.gray[910],
        'primary-bg': baseColors.gray[920],
        'primary-divider': baseColors.divider,
        'primary-success': baseColors.green[910],
        'primary-error': '#FF3E3E',
        'accent-orange': baseColors.orange[600],

        'list-item-selected': baseColors.gray[710],
        // with opacity
        'primary-card-op': 'rgba(0, 0, 0, 0.50)',
        'primary-border': 'rgba(255, 255, 255, 0.25)',
        'primary-alert-bg': 'rgba(230, 130, 38, 0.25)',
        'primary-success-bg': 'rgba(47, 143, 62, 0.25)',
        // --
        'primary-orange': baseColors.orange[500],
        'primary-orange-light': baseColors.orange[300],
        'primary-orange-dark': baseColors.orange[700],
        'primary-orange-lighter': baseColors.orange[100],
        'primary-orange-darker': baseColors.orange[900]
      };

      return {
        ...baseColors,
        ...brandColors
      };
    })(),
    backgroundColor: theme => theme('colors'),
    backgroundOpacity: theme => theme('opacity'),
    backgroundPosition: {
      bottom: 'bottom',
      center: 'center',
      left: 'left',
      'left-bottom': 'left bottom',
      'left-top': 'left top',
      right: 'right',
      'right-bottom': 'right bottom',
      'right-top': 'right top',
      top: 'top'
    },
    backgroundSize: {
      auto: 'auto',
      cover: 'cover',
      contain: 'contain'
    },
    borderColor: theme => ({
      ...theme('colors'),
      DEFAULT: theme('colors["primary-border"]', 'currentColor')
    }),
    borderOpacity: theme => theme('opacity'),
    borderRadius: {
      none: '0',
      sm: '0.125rem',
      DEFAULT: '0.25rem',
      md: '0.375rem',
      lg: '0.5rem',
      xl: '0.625rem',
      '2xl': '0.75rem',
      '2xl-plus': '1rem',
      '3xl': '1.5rem',
      full: '9999px',
      circle: '50%'
    },
    borderWidth: {
      DEFAULT: '1px',
      0: '0',
      2: '2px',
      3: '3px',
      4: '4px',
      8: '8px'
    },
    boxShadow: {
      'xs-white': '0 0 0 1px rgba(255, 255, 255, 0.05)',
      xs: '0 0 0 1px rgba(0, 0, 0, 0.05)',
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      'top-light': '0 -1px 2px 0 rgba(0, 0, 0, 0.1)',
      DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
      outline: '0 0 0 3px rgba(237, 137, 54, 0.5)',
      none: 'none'
    },
    container: {},
    cursor: {
      auto: 'auto',
      default: 'default',
      pointer: 'pointer',
      wait: 'wait',
      text: 'text',
      move: 'move',
      'not-allowed': 'not-allowed'
    },
    divideColor: theme => theme('borderColor'),
    divideOpacity: theme => theme('borderOpacity'),
    divideWidth: theme => theme('borderWidth'),
    fill: {
      current: 'currentColor',
      'accent-blue': '#5F58FF',
      white: '#f4f4f4'
    },
    flex: {
      1: '1 1 0%',
      auto: '1 1 auto',
      initial: '0 1 auto',
      none: 'none'
    },
    flexGrow: {
      0: '0',
      DEFAULT: '1'
    },
    flexShrink: {
      0: '0',
      DEFAULT: '1'
    },
    fontFamily: (() => {
      const baseFontFamily = {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          '"Noto Sans"',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
          '"Noto Color Emoji"'
        ],
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
        mono: ['Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace']
      };

      return {
        ...baseFontFamily,
        aeonik: ["'Aeonik'", ...baseFontFamily.sans]
      };
    })(),
    fontWeight: {
      hairline: '100',
      thin: '200',
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '500',
      bold: '700',
      extrabold: '800',
      black: '900'
    },
    letterSpacing: {
      tighter: '-0.05em',
      tight: '-0.025em',
      normal: '0',
      wide: '0.025em',
      wider: '0.05em',
      widest: '0.1em'
    },
    listStyleType: {
      none: 'none',
      disc: 'disc',
      decimal: 'decimal'
    },
    objectPosition: {
      bottom: 'bottom',
      center: 'center',
      left: 'left',
      'left-bottom': 'left bottom',
      'left-top': 'left top',
      right: 'right',
      'right-bottom': 'right bottom',
      'right-top': 'right top',
      top: 'top'
    },
    order: {
      first: '-9999',
      last: '9999',
      none: '0',
      1: '1',
      2: '2',
      3: '3',
      4: '4',
      5: '5',
      6: '6',
      7: '7',
      8: '8',
      9: '9',
      10: '10',
      11: '11',
      12: '12'
    },
    placeholderColor: theme => theme('colors'),
    placeholderOpacity: theme => theme('opacity'),
    stroke: {
      current: 'currentColor',
      'accent-orange': '#FF5B00',
      'accent-blue': '#5F58FF',
      white: '#f4f4f4',
      gray: '#AAA',
      orange: '#ED8936',
      cyan: '#B9EEFE'
    },
    strokeWidth: {
      0: '0',
      1: '1',
      2: '2'
    },
    textColor: theme => theme('colors'),
    textOpacity: theme => theme('opacity'),
    zIndex: {
      auto: 'auto',
      0: '0',
      10: '10',
      20: '20',
      30: '30',
      40: '40',
      50: '50'
    },
    gridTemplateColumns: {
      none: 'none',
      1: 'repeat(1, minmax(0, 1fr))',
      2: 'repeat(2, minmax(0, 1fr))',
      3: 'repeat(3, minmax(0, 1fr))',
      4: 'repeat(4, minmax(0, 1fr))',
      5: 'repeat(5, minmax(0, 1fr))',
      6: 'repeat(6, minmax(0, 1fr))',
      7: 'repeat(7, minmax(0, 1fr))',
      8: 'repeat(8, minmax(0, 1fr))',
      9: 'repeat(9, minmax(0, 1fr))',
      10: 'repeat(10, minmax(0, 1fr))',
      11: 'repeat(11, minmax(0, 1fr))',
      12: 'repeat(12, minmax(0, 1fr))'
    },
    gridColumn: {
      auto: 'auto',
      'span-1': 'span 1 / span 1',
      'span-2': 'span 2 / span 2',
      'span-3': 'span 3 / span 3',
      'span-4': 'span 4 / span 4',
      'span-5': 'span 5 / span 5',
      'span-6': 'span 6 / span 6',
      'span-7': 'span 7 / span 7',
      'span-8': 'span 8 / span 8',
      'span-9': 'span 9 / span 9',
      'span-10': 'span 10 / span 10',
      'span-11': 'span 11 / span 11',
      'span-12': 'span 12 / span 12'
    },
    gridColumnStart: {
      auto: 'auto',
      1: '1',
      2: '2',
      3: '3',
      4: '4',
      5: '5',
      6: '6',
      7: '7',
      8: '8',
      9: '9',
      10: '10',
      11: '11',
      12: '12',
      13: '13'
    },
    gridColumnEnd: {
      auto: 'auto',
      1: '1',
      2: '2',
      3: '3',
      4: '4',
      5: '5',
      6: '6',
      7: '7',
      8: '8',
      9: '9',
      10: '10',
      11: '11',
      12: '12',
      13: '13'
    },
    gridTemplateRows: {
      none: 'none',
      1: 'repeat(1, minmax(0, 1fr))',
      2: 'repeat(2, minmax(0, 1fr))',
      3: 'repeat(3, minmax(0, 1fr))',
      4: 'repeat(4, minmax(0, 1fr))',
      5: 'repeat(5, minmax(0, 1fr))',
      6: 'repeat(6, minmax(0, 1fr))'
    },
    gridRow: {
      auto: 'auto',
      'span-1': 'span 1 / span 1',
      'span-2': 'span 2 / span 2',
      'span-3': 'span 3 / span 3',
      'span-4': 'span 4 / span 4',
      'span-5': 'span 5 / span 5',
      'span-6': 'span 6 / span 6'
    },
    gridRowStart: {
      auto: 'auto',
      1: '1',
      2: '2',
      3: '3',
      4: '4',
      5: '5',
      6: '6',
      7: '7'
    },
    gridRowEnd: {
      auto: 'auto',
      1: '1',
      2: '2',
      3: '3',
      4: '4',
      5: '5',
      6: '6',
      7: '7'
    },
    transformOrigin: {
      center: 'center',
      top: 'top',
      'top-right': 'top right',
      right: 'right',
      'bottom-right': 'bottom right',
      bottom: 'bottom',
      'bottom-left': 'bottom left',
      left: 'left',
      'top-left': 'top left'
    },
    scale: {
      0: '0',
      50: '.5',
      75: '.75',
      90: '.9',
      95: '.95',
      100: '1',
      105: '1.05',
      110: '1.1',
      125: '1.25',
      150: '1.5'
    },
    rotate: {
      '-180': '-180deg',
      '-90': '-90deg',
      '-45': '-45deg',
      0: '0',
      45: '45deg',
      90: '90deg',
      180: '180deg'
    },
    translate: (theme, { negative }) => ({
      ...theme('spacing'),
      ...negative(theme('spacing')),
      '-full': '-100%',
      '-1/2': '-50%',
      '1/2': '50%',
      full: '100%'
    }),
    skew: {
      '-12': '-12deg',
      '-6': '-6deg',
      '-3': '-3deg',
      0: '0',
      3: '3deg',
      6: '6deg',
      12: '12deg'
    },
    transitionProperty: {
      none: 'none',
      all: 'all',
      DEFAULT: 'background-color, border-color, color, fill, stroke, opacity, box-shadow, transform',
      colors: 'background-color, border-color, color, fill, stroke',
      opacity: 'opacity',
      shadow: 'box-shadow',
      transform: 'transform'
    },
    transitionTimingFunction: {
      linear: 'linear',
      in: 'cubic-bezier(0.4, 0, 1, 1)',
      out: 'cubic-bezier(0, 0, 0.2, 1)',
      'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)'
    },
    transitionDuration: {
      75: '75ms',
      100: '100ms',
      150: '150ms',
      200: '200ms',
      300: '300ms',
      500: '500ms',
      700: '700ms',
      1000: '1000ms'
    },
    transitionDelay: {
      75: '75ms',
      100: '100ms',
      150: '150ms',
      200: '200ms',
      300: '300ms',
      500: '500ms',
      700: '700ms',
      1000: '1000ms'
    },
    animation: {
      none: 'none',
      spin: 'spin 1s linear infinite',
      ping: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
      pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      bounce: 'bounce 1s infinite',
      drop: 'drop 200ms ease-in-out'
    },
    keyframes: {
      spin: {
        from: { transform: 'rotate(0deg)' },
        to: { transform: 'rotate(360deg)' }
      },
      ping: {
        '0%': { transform: 'scale(1)', opacity: '1' },
        '75%, 100%': { transform: 'scale(2)', opacity: '0' }
      },
      pulse: {
        '0%, 100%': { opacity: '1' },
        '50%': { opacity: '.5' }
      },
      drop: {
        '0%': { maxHeight: '1px' },
        '100%': { maxHeight: '400px' }
      },
      bounce: {
        '0%, 100%': {
          transform: 'translateY(-25%)',
          animationTimingFunction: 'cubic-bezier(0.8,0,1,1)'
        },
        '50%': {
          transform: 'translateY(0)',
          animationTimingFunction: 'cubic-bezier(0,0,0.2,1)'
        }
      }
    },
    extend: {
      fontSize: {
        xxxs: '0.625rem',
        xxs: '0.6875rem',
        xs: [
          '0.75rem',
          {
            lineHeight: 'normal',
            letterSpacing: '-0.24px',
            fontWeight: '400'
          }
        ],
        '2xs': '0.8125rem',
        ulg: '1.0625rem',
        sm: [
          '0.875rem',
          {
            lineHeight: 'normal',
            letterSpacing: '-0.28px',
            fontWeight: '400'
          }
        ],
        base: [
          '1rem',
          {
            lineHeight: 'normal',
            letterSpacing: 'normal',
            fontWeight: '400'
          }
        ],
        'base-plus': [
          '1rem',
          {
            lineHeight: 'normal',
            letterSpacing: '-0.32px',
            fontWeight: '400'
          }
        ],
        '2xl-plus': '1.75rem',

        '3xl-plus': [
          '2rem',
          {
            lineHeight: 'normal',
            letterSpacing: '-0.64px',
            fontWeight: '400'
          }
        ]
      },
      spacing: {
        '2px': '2px',
        10: '0.625rem',
        '12px': '12px',
        '14px': '14px',
        4.5: '18px',
        '40px': '2.5rem',
        '14px': '0.875rem',
        '10px': '0.6rem',
        13: '3.25rem',
        15: '3.75rem',
        18: '4.5rem',
        21: '5.25rem',
        23: '5.75rem',
        25: '6.25rem',
        26.5: '6.625rem',
        29: '7.25rem',
        31.25: '7.8125rem',
        35: '8.75rem',
        60.5: '15.125rem',
        63: '15.75rem',
        '66px': '4.125rem',
        '154px': '9.625rem',
        '163px': '10.188rem',
        500: '31.25rem',
        max: '100%'
      },
      height: theme => theme('spacing'),
      minHeight: theme => theme('height'),
      maxHeight: theme => theme('height'),
      width: theme => theme('spacing'),
      minWidth: theme => theme('width'),
      maxWidth: (theme, { breakpoints }) => ({
        ...theme('width'),
        xs: '20rem',
        sm: '24rem',
        md: '28rem',
        lg: '32rem',
        xl: '36rem',
        '2xl': '42rem',
        '3xl': '48rem',
        '4xl': '56rem',
        '5xl': '64rem',
        '6xl': '72rem',
        '9/10': '90%',
        ...breakpoints(theme('screens'))
      }),
      margin: (theme, { negative }) => ({
        ...theme('spacing'),
        ...negative(theme('spacing'))
      }),
      padding: theme => ({
        ...theme('spacing'),
        '1/2': '50%',
        '1/3': '33.333333%',
        '2/3': '66.666667%',
        '1/4': '25%',
        '2/4': '50%',
        '3/4': '75%',
        '1/5': '20%',
        '2/5': '40%',
        '3/5': '60%',
        '4/5': '80%',
        '1/6': '16.666667%',
        '2/6': '33.333333%',
        '3/6': '50%',
        '4/6': '66.666667%',
        '5/6': '83.333333%',
        '1/12': '8.333333%',
        '2/12': '16.666667%',
        '3/12': '25%',
        '4/12': '33.333333%',
        '5/12': '41.666667%',
        '6/12': '50%',
        '7/12': '58.333333%',
        '8/12': '66.666667%',
        '9/12': '75%',
        '10/12': '83.333333%',
        '11/12': '91.666667%',
        full: '100%'
      }),
      inset: {
        '2px': '2px',
        '1/2': '50%',
        18: '4.5rem'
      },
      space: (theme, { negative }) => ({
        ...theme('spacing'),
        ...negative(theme('spacing'))
      }),
      gap: theme => theme('spacing')
    }
  },
  variants: {
    accessibility: ['responsive', 'focus'],
    alignContent: ['responsive'],
    alignItems: ['responsive'],
    alignSelf: ['responsive'],
    appearance: ['responsive'],
    backgroundAttachment: ['responsive'],
    backgroundColor: ['responsive', 'hover', 'focus'],
    backgroundOpacity: ['responsive', 'hover', 'focus'],
    backgroundPosition: ['responsive'],
    backgroundRepeat: ['responsive'],
    backgroundSize: ['responsive'],
    borderCollapse: ['responsive'],
    borderColor: ['responsive', 'hover', 'focus'],
    borderOpacity: ['responsive', 'hover', 'focus'],
    borderRadius: ['responsive'],
    borderStyle: ['responsive'],
    borderWidth: ['responsive'],
    boxShadow: ['responsive', 'hover', 'focus'],
    boxSizing: ['responsive'],
    container: ['responsive'],
    cursor: ['responsive'],
    display: ['responsive'],
    divideColor: ['responsive'],
    divideOpacity: ['responsive'],
    divideWidth: ['responsive'],
    fill: ['responsive'],
    flex: ['responsive'],
    flexDirection: ['responsive'],
    flexGrow: ['responsive'],
    flexShrink: ['responsive'],
    flexWrap: ['responsive'],
    float: ['responsive'],
    clear: ['responsive'],
    fontFamily: ['responsive'],
    fontSize: ['responsive'],
    fontSmoothing: ['responsive'],
    fontStyle: ['responsive'],
    fontWeight: ['responsive', 'hover', 'focus'],
    height: ['responsive'],
    inset: ['responsive'],
    justifyContent: ['responsive'],
    letterSpacing: ['responsive'],
    lineHeight: ['responsive'],
    listStylePosition: ['responsive'],
    listStyleType: ['responsive'],
    margin: ['responsive'],
    maxHeight: ['responsive'],
    maxWidth: ['responsive'],
    minHeight: ['responsive'],
    minWidth: ['responsive'],
    objectFit: ['responsive'],
    objectPosition: ['responsive'],
    opacity: ['responsive', 'hover', 'focus'],
    order: ['responsive'],
    outline: ['responsive', 'focus'],
    overflow: ['responsive'],
    overscrollBehavior: ['responsive'],
    padding: ['responsive'],
    placeholderColor: ['responsive', 'focus'],
    placeholderOpacity: ['responsive', 'focus'],
    pointerEvents: ['responsive'],
    position: ['responsive'],
    resize: ['responsive'],
    space: ['responsive'],
    stroke: ['responsive'],
    strokeWidth: ['responsive'],
    tableLayout: ['responsive'],
    textAlign: ['responsive'],
    textColor: ['responsive', 'hover', 'focus'],
    textOpacity: ['responsive', 'hover', 'focus'],
    textDecoration: ['responsive', 'hover', 'focus'],
    textTransform: ['responsive'],
    userSelect: ['responsive'],
    verticalAlign: ['responsive'],
    visibility: ['responsive'],
    whitespace: ['responsive'],
    width: ['responsive'],
    wordBreak: ['responsive'],
    zIndex: ['responsive'],
    gap: ['responsive'],
    gridAutoFlow: ['responsive'],
    gridTemplateColumns: ['responsive'],
    gridColumn: ['responsive'],
    gridColumnStart: ['responsive'],
    gridColumnEnd: ['responsive'],
    gridTemplateRows: ['responsive'],
    gridRow: ['responsive'],
    gridRowStart: ['responsive'],
    gridRowEnd: ['responsive'],
    transform: ['responsive'],
    transformOrigin: ['responsive'],
    scale: ['responsive', 'hover', 'focus'],
    rotate: ['responsive', 'hover', 'focus'],
    translate: ['responsive', 'hover', 'focus'],
    skew: ['responsive', 'hover', 'focus'],
    transitionProperty: ['responsive'],
    transitionTimingFunction: ['responsive'],
    transitionDuration: ['responsive'],
    transitionDelay: ['responsive'],
    animation: ['responsive'],
    textOverflow: ['responsive', 'group-hover']
  },
  corePlugins: {},
  plugins: []
};
