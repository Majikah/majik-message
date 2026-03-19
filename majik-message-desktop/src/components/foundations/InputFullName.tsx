import React, { useEffect, useState } from "react";
import styled from "styled-components";

import CustomInputField from "./CustomInputField";
import { toast } from "sonner";
import CustomToggleSwitch from "./CustomToggleSwitch";
import { FullName } from "@thezelijah/majik-user";

// Styled component for the frosted glass effect and full space usage
const RootContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: inherit;
  height: inherit;
  border-radius: 10px;
  gap: 15px;
`;

// Type definition for the props
interface InputFullNameProps {
  onUpdate?: (value: FullName) => void;
  currentName?: FullName | null;
}

// Stateless functional component
const InputFullName: React.FC<InputFullNameProps> = ({
  onUpdate,
  currentName,
}) => {
  const [currentFullName, setCurrentFullName] = useState<FullName>({
    first_name: currentName?.first_name || "",
    last_name: currentName?.last_name || "",
    suffix: currentName?.suffix || undefined,
    middle_name: currentName?.middle_name || undefined,
  });

  useEffect(() => {
    if (
      !!currentFullName &&
      currentFullName.first_name.trim() !== "" &&
      currentFullName.last_name.trim() !== ""
    ) {
      onUpdate?.(currentFullName);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFullName]);

  const handleChangeFirstName = (input: string): void => {
    if (!!input && input.trim() !== "") {
      const updatedFullName: FullName = {
        ...currentFullName,
        first_name: input,
      };
      setCurrentFullName(updatedFullName);
    } else {
      toast.error("Please provide a valid legal first name.");
    }
  };

  const handleChangeLastName = (input: string): void => {
    if (!!input && input.trim() !== "") {
      const updatedFullName: FullName = {
        ...currentFullName,
        last_name: input,
      };
      setCurrentFullName(updatedFullName);
    } else {
      toast.error("Please provide a valid legal surname.");
    }
  };

  const handleChangeMiddleName = (input: string): void => {
    const updatedFullName: FullName = {
      ...currentFullName,
      middle_name: input || undefined,
    };
    setCurrentFullName(updatedFullName);
  };

  const handleChangeNameSuffix = (input: string): void => {
    const updatedFullName: FullName = {
      ...currentFullName,
      suffix: input || undefined,
    };
    setCurrentFullName(updatedFullName);
  };

  const handleToggleNameSuffix = (input: boolean): void => {
    if (!input) {
      const updatedFullName: FullName = {
        ...currentFullName,
        suffix: undefined,
      };
      setCurrentFullName(updatedFullName);
    }
  };

  return (
    <RootContainer>
      <CustomInputField
        key="iffirst_name"
        label="First Name"
        capitalize="word"
        onChange={handleChangeFirstName}
        required
        currentValue={currentFullName.first_name}
      />

      <CustomInputField
        key="ifmiddle_name"
        label="Middle Name"
        capitalize="word"
        onChange={handleChangeMiddleName}
        currentValue={currentFullName.middle_name}
      />

      <CustomInputField
        key="ifSurname"
        label="Surname"
        capitalize="word"
        onChange={handleChangeLastName}
        required
        currentValue={currentFullName.last_name}
      />

      <CustomToggleSwitch
        key="ifNameSuffix"
        label="Suffix"
        capitalize="character"
        onChange={handleChangeNameSuffix}
        maxChar={5}
        requireInput
        currentValue={currentFullName.suffix}
        currentToggle={!!currentFullName?.suffix}
        onToggle={handleToggleNameSuffix}
        helper="Toggle this to add a suffix to your name"
      />
    </RootContainer>
  );
};

export default InputFullName;
