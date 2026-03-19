import React, { useState } from "react";
import styled from "styled-components";

import CustomInputField from "../foundations/CustomInputField";
import { Address } from "@thezelijah/majik-user";


interface InputAddressProps {
  /** Function to handle updates to the full name */
  onUpdate?: (updatedAddress: Address) => void;
  /** Current full name */
  currentAddress?: Address | null;
}

const RootContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: inherit;
  height: inherit;
  border-radius: 10px;
  gap: 15px;
`;

const InputAddress: React.FC<InputAddressProps> = ({
  onUpdate,
  currentAddress,
}) => {
  const [fullAddress, setFullAddress] = useState<Address>({
    country: currentAddress?.country || "",
    city: currentAddress?.city || "",
    area: currentAddress?.area || "",
    street: currentAddress?.street || "",
    building: currentAddress?.building || "",
    zip: currentAddress?.zip || "",
  });

  const handleChangeCountry = (input: string): void => {
    setFullAddress((prev) => {
      const next: Address = { ...prev, country: input };
      onUpdate?.(next);
      return next;
    });
  };

  const handleChangeCity = (input: string): void => {
    setFullAddress((prev) => {
      const next: Address = { ...prev, city: input };
      onUpdate?.(next);
      return next;
    });
  };

  const handleChangeArea = (input: string): void => {
    setFullAddress((prev) => {
      const next: Address = { ...prev, area: input };
      onUpdate?.(next);
      return next;
    });
  };

  const handleChangeStreet = (input: string): void => {
    setFullAddress((prev) => {
      const next: Address = { ...prev, street: input };
      onUpdate?.(next);
      return next;
    });
  };

  const handleChangeBuilding = (input: string): void => {
    setFullAddress((prev) => {
      const next: Address = { ...prev, building: input };
      onUpdate?.(next);
      return next;
    });
  };

  const handleChangeZip = (input: string): void => {
    setFullAddress((prev) => {
      const next: Address = { ...prev, zip: input };
      onUpdate?.(next);
      return next;
    });
  };

  return (
    <RootContainer>
      <CustomInputField
        label="Country"
        isLabelHint={false}
        onChange={handleChangeCountry}
        currentValue={fullAddress.country ?? ""}
        capitalize="word"
      />
      <CustomInputField
        label="City"
        isLabelHint={false}
        onChange={handleChangeCity}
        currentValue={fullAddress.city ?? ""}
        capitalize="word"
      />
      <CustomInputField
        label="Area/Barangay"
        isLabelHint={false}
        onChange={handleChangeArea}
        currentValue={fullAddress.area ?? ""}
        capitalize="word"
      />
      <CustomInputField
        label="Street"
        isLabelHint={false}
        onChange={handleChangeStreet}
        currentValue={fullAddress.street ?? ""}
        capitalize="word"
      />

      <CustomInputField
        label="Building"
        isLabelHint={false}
        onChange={handleChangeBuilding}
        currentValue={fullAddress.building ?? ""}
        capitalize="word"
      />
      <CustomInputField
        label="Postal/ZIP Code"
        isLabelHint={false}
        regex="numbers"
        onChange={handleChangeZip}
        currentValue={fullAddress.zip ?? ""}
        maxChar={4}
      />
    </RootContainer>
  );
};

export default InputAddress;
