


import React, { useState, useRef, useEffect, ChangeEvent } from "react";
import { Tooltip } from "react-tooltip";

import { toast } from "sonner";
import styled from "styled-components";
import { autocapitalize } from "../../../utils/utils";
import theme from "../../../globals/theme";

const CharacterCount = styled.div<{ $isexceeded: boolean }>`
  align-self: flex-end;
  font-size: ${({ theme }) => theme.typography.sizes.helper};
  color: ${({ theme, $isexceeded }) => ($isexceeded ? theme.colors.error : theme.colors.textSecondary)};
  margin-top: ${({ theme }) => theme.spacing.small};
`;

const InputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;


`;

interface EditableTextProps {
    initialName?: string;
    refKey?: string;
    onUpdate: (newName: string, refKey?: string) => void;
    allowEmpty?: boolean;
    tooltip?: string;
    maxChar?: number;
    minChar?: number;
    capitalize?: "word" | "character" | "sentence" | "first" | null;
    id?: string;
    regex?: 'alphanumeric' | 'alphanumeric-code' | 'numbers' | 'letters' | 'all';
}



export function EditableText({
    capitalize,
    initialName,
    refKey,
    onUpdate,
    allowEmpty = false,
    tooltip = "Edit Text",
    maxChar = 0,
    regex = 'all',
    id
}: EditableTextProps) {


    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [value, setValue] = useState<string | undefined>(initialName);
    const inputRef = useRef<HTMLInputElement>(null);

    const [charCount, setCharCount] = useState<number>(initialName?.length || 0);

    useEffect(() => {

        setValue(initialName)

    }, [initialName]);



    const validateInput = (value: string): boolean => {
        let regexPattern: RegExp;

        switch (regex) {
            case 'alphanumeric':
                regexPattern = /^[a-zA-Z0-9]*$/;
                break;
            case 'alphanumeric-code':
                regexPattern = /^[a-zA-Z0-9-_]*$/; // Allows letters, numbers, dashes, and underscores
                break;
            case 'numbers':
                regexPattern = /^\d*\.?\d{0,2}$/;
                break;
            case 'letters':
                regexPattern = /^[a-zA-Z\s]*$/;
                break;
            case 'all':
                return true;
            default:
                regexPattern = /.*/;
                break;
        }

        return regexPattern.test(value) && (value.match(/\s/g) || []).length <= 3;
    };





    const handleSave = () => {
        const trimmed = value?.trim();

        // 1. Cancel if unchanged
        if (trimmed === initialName) {
            setIsEditing(false);
            return;
        }


        // 2. Cancel if empty
        if (!trimmed && !allowEmpty) {
            toast.error("Group name cannot be empty.");
            setValue(initialName); // revert
            setIsEditing(false);
            return;
        }



        if (!!trimmed) {
            try {
                if (!!capitalize) {

                    const capitalizedWord = autocapitalize(trimmed, capitalize);
                    setValue(capitalizedWord);
                    onUpdate(capitalizedWord, refKey);

                } else {
                    setValue(trimmed);
                    onUpdate?.(trimmed, refKey);

                }



            } catch (err) {
                toast.error((err as Error).message);
                setValue(initialName);
            }

        }


        setIsEditing(false);
    };

    const handleEnterKey = (e: React.KeyboardEvent<HTMLInputElement>) => {

        if (e.key === "Enter") inputRef.current?.blur();
        if (e.key === "Escape") {
            setValue(initialName);
            setIsEditing(false);
        }
    };

    const handleBeforeInput = (event: React.FormEvent<HTMLInputElement> & { data: string }) => {
        if (!validateInput(event.data)) {
            event.preventDefault(); // ✅ Prevent invalid character from ever being typed
        }
    };



    const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
        const { value } = event.target;
        const characterCount = value.length;
        setCharCount(characterCount);


        if (maxChar > 0 && value.length > maxChar) {
            return;
        }

        setValue(value);


    };

    const isExceeded = charCount > 2500;

    return (
        <EditableTextWrapper
            $isEditing={isEditing}
            id={id}
        >
            {isEditing ? (
                <InputWrapper>
                    <GroupInput
                        ref={inputRef}
                        value={value || ""}
                        onChange={handleChange}
                        onBlur={handleSave}
                        onKeyDown={handleEnterKey}
                        onBeforeInput={handleBeforeInput}
                    />

                    {maxChar !== 0 &&
                        <CharacterCount $isexceeded={isExceeded}>{charCount}/{maxChar}</CharacterCount>
                    }
                </InputWrapper>

            ) : (

                <GroupLabelText
                    onClick={() => {
                        if (!isEditing) {
                            setIsEditing(true);
                            setTimeout(() => inputRef.current?.focus(), 0);
                        }
                    }}
                    $isEmpty={!value?.trim()}
                    data-tooltip-id={`rtip-editable-text-${refKey}`}
                    data-tooltip-content={tooltip}
                >
                    {value || "No information available"}
                </GroupLabelText>


            )}
            <Tooltip id={`rtip-editable-text-${refKey}`} style={{ fontSize: 12, fontWeight: 400, backgroundColor: theme.colors.secondaryBackground }} />
        </EditableTextWrapper>
    );
}

/* ---------- styled ---------- */

const EditableTextWrapper = styled.div<{ $isEditing: boolean }>`
  display: flex;
  width: 100%;
  align-items: center;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  cursor: text;
  transition: all 0.2s ease;
  border: 1px solid transparent;

  ${({ $isEditing, theme }) =>
        !$isEditing &&
        `
      &:hover {
        border: 1px solid ${theme.colors.primary};
        background: rgba(234, 127, 5, 0.05);
      }
    `}
`;

const GroupInput = styled.input`
  width: 100%;
   font-size: ${({ theme }) => theme.typography.sizes.label};
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.textPrimary};
  border-radius: 6px;
  padding: 2px 6px;
  outline: none;
  color: ${({ theme }) => theme.colors.textPrimary};
`;




interface SectionTitleProps {
    alignment?: 'left' | 'center' | 'right';
    $isEmpty?: boolean;
}

const GroupLabelText = styled.div<SectionTitleProps>`
  width: 100%;
  font-size: ${({ theme }) => theme.typography.sizes.label};
  transition: all 0.2s ease;
  opacity: ${(props) => props.$isEmpty ? '0.6' : "unset"};


  display: flex;
  justify-content: space-between;



  color: ${({ theme }) => theme.colors.textPrimary};
  text-align: ${(props) => props.alignment || 'left'};

`;

