'use client';

import { ThemeProvider } from 'styled-components';


import { useSelector } from 'react-redux';
import { useMemo } from 'react';

import { ReduxSystemRootState } from '../redux/slices/system';
import theme from './theme';

export default function ThemeProviderWrapper({
    children,
}: {
    children: React.ReactNode;
}) {
    // Get darkMode state from Redux
    const darkMode = useSelector((state: ReduxSystemRootState) => state.system.darkMode ?? false);

    // Dynamically create theme
    const dynamicTheme = useMemo(() => {
        return {
            ...theme,
            colors: {
                ...theme.colors,
                primaryBackground: !!darkMode ? '#151515' : theme.colors.primaryBackground,
                secondaryBackground: !!darkMode ? '#222020ff' : theme.colors.secondaryBackground,
                textPrimary: !!darkMode ? '#f8eee2' : theme.colors.textPrimary,
                textSecondary: !!darkMode ? '#f2e0cb' : theme.colors.textSecondary,
                semitransparent: darkMode ? "#1a191882" : theme.colors.semitransparent,

                brand: {
                    green: theme.colors.brand.green,
                    red: theme.colors.brand.red,
                    blue: theme.colors.brand.blue,
                    white: theme.colors.brand.white
                },
                disabled: '#1e2021'
            },
        };
    }, [darkMode]);

    return <ThemeProvider theme={dynamicTheme}>{children}</ThemeProvider>;
}