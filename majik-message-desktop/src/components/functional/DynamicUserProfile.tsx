/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useCallback, useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { toast } from "sonner";

import { parseDateFromISO } from "@/utils/utils";
import {
  UserGenderOptions,
  type MajikUser,
  type Address,
  type FullName,
} from "@thezelijah/majik-user";

import type { MajikahSession } from "../majikah-session-wrapper/majikah-session";

import DynamicPlaceholder from "../foundations/DynamicPlaceholder";
import PopUpFormButton from "../foundations/PopUpFormButton";
import { ChoiceButton } from "@src/globals/buttons";

import ThemeToggle from "./ThemeToggle";
import CustomInputField from "../foundations/CustomInputField";

// ─── Local tokens ─────────────────────────────────────────────────────────────
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getHue(str: string): number {
  return [...str].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Animations ───────────────────────────────────────────────────────────────
const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ─── Layout ───────────────────────────────────────────────────────────────────
const Root = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
  animation: ${fadeUp} 220ms cubic-bezier(0.4, 0, 0.2, 1) both;
`;

// ─── Panel header (matches AccountsPanel / ConversationSidePanel) ─────────────
const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  margin-bottom: 16px;
`;

const HeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const PanelTitle = styled.h2`
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
  text-align: left;
`;

const PanelSubtitle = styled.p`
  font-family: ${FONT_MONO};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  opacity: 0.5;
  letter-spacing: 0.03em;
  text-align: left;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
`;

// ─── Hero card ────────────────────────────────────────────────────────────────
/**
 * Single unified surface — avatar, name, status, info strip, identity row.
 * Radial gradient sweep top-right gives depth without heaviness.
 */
const HeroCard = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 18px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  border-radius: 16px;
  padding: 24px;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    right: 0;
    width: 300px;
    height: 180px;
    background: radial-gradient(
      ellipse at top right,
      rgba(79, 110, 247, 0.06) 0%,
      transparent 70%
    );
    pointer-events: none;
  }
`;

const HeroTop = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 16px;
`;

// ─── Avatar ───────────────────────────────────────────────────────────────────
/**
 * 64px square with 16px radius — larger than the 40px account cards since
 * this is the user's own profile hero. Same square-radius identity language.
 */
const AvatarWrap = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const Avatar = styled.div<{ $hue: number }>`
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: hsl(${({ $hue }) => $hue}, 38%, 22%);
  border: 1px solid rgba(255, 255, 255, 0.07);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${FONT_MONO};
  font-size: 22px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.78);
  user-select: none;
`;

const AuthDot = styled.span`
  position: absolute;
  bottom: -3px;
  right: -3px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.brand?.green ?? "#10b981"};
  border: 2.5px solid ${({ theme }) => theme.colors.secondaryBackground};
`;

// ─── Hero identity meta ───────────────────────────────────────────────────────
const HeroMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
`;

const HeroName = styled.h1`
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
`;

const HeroEmail = styled.p`
  font-family: ${FONT_MONO};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  opacity: 0.65;
  letter-spacing: 0.03em;
  text-align: left;
`;

const AuthBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 100px;
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  background: rgba(16, 185, 129, 0.1);
  color: ${({ theme }) => theme.colors.brand.green};
  border: 1px solid rgba(16, 185, 129, 0.2);
  width: fit-content;
`;

const BadgeDot = styled.span`
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
`;

// ─── Info strip ───────────────────────────────────────────────────────────────
/**
 * 4-column grid with 1px gap acting as separators — visually lighter than
 * four separate card boxes. Each cell is a flat surface on the hero card.
 */
const InfoStrip = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: ${({ theme }) => theme.colors.primaryBackground};
  border-radius: 10px;
  overflow: hidden;

  @media (max-width: 640px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const InfoCell = styled.div`
  background: ${({ theme }) => theme.colors.secondaryBackground};
  /* Match the parent card background so the inner strip blends */
  background: rgba(255, 255, 255, 0.025);
  padding: 11px 14px;
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const InfoLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
`;

const InfoValue = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

// ─── Identity selector row ────────────────────────────────────────────────────
/**
 * Sits at the bottom of the hero card — primary-tinted to distinguish it
 * from the info strip above. Houses the MajikMessageIdentitySelector.
 */
// const IdentityRow = styled.div`
//   display: flex;
//   align-items: center;
//   gap: 12px;
//   padding: 10px 14px;
//   background: ${({ theme }) => theme.colors.primarySoft};
//   box-shadow: 1px 1px 3px rgba(0, 0, 0, 0.15);
//   border-radius: 10px;
// `;

// const IdentityMeta = styled.div`
//   display: flex;
//   flex-direction: column;
//   gap: 2px;
//   flex-shrink: 0;
// `;

// const IdentityLabel = styled.span`
//   font-family: ${FONT_MONO};
//   font-size: 9px;
//   font-weight: 600;
//   letter-spacing: 0.06em;
//   text-transform: uppercase;
//   color: ${({ theme }) => theme.colors.textSecondary};
//   opacity: 0.45;
// `;

// const IdentitySelectorWrap = styled.div`
//   flex: 1;
//   min-width: 0;
// `;

// ─── Loading state ────────────────────────────────────────────────────────────
const LoadingWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 260px;
`;

// ─── Edit form internals ──────────────────────────────────────────────────────
const FormGroup = styled.div`
  margin-bottom: 1.25rem;
`;

const FormLabel = styled.label`
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: 6px;
  letter-spacing: -0.01em;
`;

const Required = styled.span`
  color: ${({ theme }) => theme.colors.error ?? theme.colors.primary};
  margin-left: 3px;
`;

const FormDivider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.primaryBackground};
  margin: 1.25rem 0;
`;

const InputRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
`;

/**
 * Styled <select> — matches theme. Used for gender dropdown in edit form.
 */
const StyledSelect = styled.select`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  border-radius: 8px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textPrimary};
  background: ${({ theme }) => theme.colors.primaryBackground};
  cursor: pointer;
  outline: none;
  transition: border-color 120ms ease;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }

  option {
    background: ${({ theme }) => theme.colors.secondaryBackground};
  }
`;

/**
 * Styled date input — matches StyledSelect above.
 */
const StyledDateInput = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  border-radius: 8px;
  font-size: 13px;
  font-family: ${FONT_MONO};
  color: ${({ theme }) => theme.colors.textPrimary};
  background: ${({ theme }) => theme.colors.primaryBackground};
  outline: none;
  transition: border-color 120ms ease;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &::-webkit-calendar-picker-indicator {
    filter: invert(0.5);
    cursor: pointer;
  }
`;

// ─── Constants ────────────────────────────────────────────────────────────────
const defaultAddress: Address = {
  country: "Philippines",
  city: "Manila",
  area: "Unset",
  street: "Unset",
  building: "Unset",
  zip: "0000",
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface DynamicUserProfileProps {
  session: MajikahSession;
  userData: MajikUser;
  onUpdate?: (userData: MajikUser) => void;
  onSave?: () => void;
  onEdit?: (bool: boolean) => void;
  onValidated?: (isValid: boolean) => void;
  onSignout?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const DynamicUserProfile: React.FC<DynamicUserProfileProps> = ({
  session,
  userData,
  onUpdate,
  onSave,
  onEdit,
  onValidated,
  onSignout,
}) => {
  const [currentUserAccount, setCurrentUserAccount] =
    useState<MajikUser>(userData);
  const [originalUserAccount, setOriginalUserAccount] =
    useState<MajikUser>(userData);
  const [loading, setIsLoading] = useState<boolean>(false);
  const [isProceedEnabled, setIsProceedEnabled] = useState(false);

  const isRefreshingRef = useRef(false);

  // ── Sync original when ID changes ─────────────────────────────────────────
  useEffect(() => {
    if (!!currentUserAccount && !!currentUserAccount?.id) {
      setOriginalUserAccount(currentUserAccount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserAccount.id]);

  // ── Refresh user data on mount ─────────────────────────────────────────────
  const refreshUserData = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      setIsLoading(true);
      await session.refreshUserData();
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error(error);
        toast.error("Failed to refresh user data.");
      }
    } finally {
      isRefreshingRef.current = false;
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    refreshUserData();
  }, [refreshUserData]);

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateForm = (): boolean => {
    return currentUserAccount.validate().isValid || false;
  };

  // ── Field change handler ───────────────────────────────────────────────────
  const handleFieldChange = (field: string, value: any): void => {
    if (!value) return;
    try {
      setCurrentUserAccount((prev) => {
        const updated = prev.clone();

        if (field === "displayName") {
          if (!value.trim()) return prev;
          updated.displayName = value.trim() ? value : prev.displayName;
        } else if (field === "firstName" || field === "lastName") {
          const name: FullName = {
            first_name: field === "firstName" ? value : prev.firstName,
            last_name: field === "lastName" ? value : prev.lastName,
          };
          updated.setName(name);
        } else if (field === "gender") {
          updated.setGender(value as UserGenderOptions);
        } else if (field === "birthdate") {
          updated.setBirthdate(value);
        } else if (field.startsWith("address.")) {
          const addressField = field.split(".")[1];
          const currentAddress = prev.metadata.address || defaultAddress;
          const newAddress = { ...currentAddress, [addressField]: value };
          updated.setAddress(newAddress);
        }

        onUpdate?.(updated);
        return updated;
      });

      const isValid = validateForm();
      setIsProceedEnabled(isValid);
      onValidated?.(isValid);
    } catch (error) {
      toast.error(`Failed to update ${field}: ${error}. Please try again.`);
    }
  };

  // ── Cancel edit ────────────────────────────────────────────────────────────
  const handleCancelEdit = (): void => {
    setCurrentUserAccount(originalUserAccount);
    onEdit?.(false);
  };

  // ── Save profile ───────────────────────────────────────────────────────────
  const handleSaveProfile = async (): Promise<void> => {
    if (!currentUserAccount) {
      toast.error(
        "Please try refreshing or clearing your session and log in again.",
      );
      return;
    }
    setIsLoading(true);
    try {
      const userJSON = currentUserAccount.toJSON();
      const response = await session.updateUserProfile(userJSON);
      if (response.success) {
        toast.success(response.message);
        setOriginalUserAccount(currentUserAccount);
        onEdit?.(false);
        onUpdate?.(currentUserAccount);
        onSave?.();
      } else {
        toast.error(`Failed to update your account. ${response.message}`);
      }
    } catch (error: any) {
      toast.error(`Failed to complete the process: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Sign out ───────────────────────────────────────────────────────────────
  const handleSignOut = async (): Promise<void> => {
    await session.signOut();
    // majik.clearAllCaches();
    onSignout?.();
  };

  // ── Derived display values ─────────────────────────────────────────────────
  const displayName = originalUserAccount?.displayName || "User";
  const avatarHue = getHue(displayName);
  const initials = getInitials(displayName);

  const birthdayDisplay = !originalUserAccount?.metadata?.birthdate?.trim()
    ? "Not set"
    : `${parseDateFromISO(originalUserAccount.metadata.birthdate, true)} · ${originalUserAccount?.age}y`;

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Root>
        <LoadingWrap>
          <DynamicPlaceholder loading>Loading your profile…</DynamicPlaceholder>
        </LoadingWrap>
      </Root>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Root>
      {/* ── Panel header ── */}
      <PanelHeader>
        <HeaderLeft>
          <PanelTitle>My Profile</PanelTitle>
          <PanelSubtitle>
            Account Settings &amp; Personal Information
          </PanelSubtitle>
        </HeaderLeft>

        <HeaderActions>
          <ThemeToggle size={32} />

          <ChoiceButton $variant="secondary" onClick={handleSignOut}>
            Log Out
          </ChoiceButton>

          {/* Edit profile form — same PopUpFormButton pattern as AccountsPanel */}
          <PopUpFormButton
            scrollable
            text="Edit Profile"
            modal={{
              title: "Edit Profile",
              description:
                "Update your personal information and address details.",
            }}
            buttons={{
              cancel: {
                text: "Cancel",
                onClick: handleCancelEdit,
              },
              confirm: {
                text: loading ? "Saving…" : "Save Changes",
                isDisabled: !isProceedEnabled || loading,
                onClick: handleSaveProfile,
              },
            }}
          >
            {/* Display name */}
            <FormGroup>
              <CustomInputField
                label="Display Name"
                required
                currentValue={currentUserAccount?.displayName}
                onChange={(e) => handleFieldChange("displayName", e)}
                placeholder="Enter your display name"
                maxChar={100}
                regex="letters"
                sensitive
              />
            </FormGroup>

            {/* First + last name */}
            <InputRow>
              <FormGroup>
                <CustomInputField
                  label="First Name"
                  required
                  currentValue={currentUserAccount?.firstName || ""}
                  onChange={(e) => handleFieldChange("firstName", e)}
                  placeholder="First name"
                  maxChar={100}
                  regex="letters"
                  sensitive
                />
              </FormGroup>
              <FormGroup>
                <CustomInputField
                  label="Last Name"
                  required
                  currentValue={currentUserAccount?.lastName || ""}
                  onChange={(e) => handleFieldChange("lastName", e)}
                  placeholder="Last name"
                  maxChar={150}
                  regex="letters"
                  sensitive
                />
              </FormGroup>
            </InputRow>

            {/* Gender + DOB */}
            <InputRow>
              <FormGroup>
                <FormLabel>
                  Gender<Required>*</Required>
                </FormLabel>
                <StyledSelect
                  value={currentUserAccount?.gender || UserGenderOptions.OTHER}
                  onChange={(e) => handleFieldChange("gender", e.target.value)}
                >
                  {Object.values(UserGenderOptions).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </StyledSelect>
              </FormGroup>

              <FormGroup>
                <FormLabel>
                  Date of Birth<Required>*</Required>
                </FormLabel>
                <StyledDateInput
                  type="date"
                  value={currentUserAccount?.metadata?.birthdate || ""}
                  onChange={(e) =>
                    handleFieldChange("birthdate", new Date(e.target.value))
                  }
                  data-private
                />
              </FormGroup>
            </InputRow>

            <FormDivider />

            {/* Address fields */}
            <FormGroup>
              <CustomInputField
                label="Country"
                required
                currentValue={
                  currentUserAccount?.metadata.address?.country ||
                  defaultAddress.country
                }
                onChange={(e) => handleFieldChange("address.country", e)}
                placeholder="Country"
                maxChar={100}
                regex="letters"
                sensitive
              />
            </FormGroup>

            <InputRow>
              <FormGroup>
                <CustomInputField
                  label="City"
                  required
                  currentValue={
                    currentUserAccount?.metadata.address?.city ||
                    defaultAddress.city
                  }
                  onChange={(e) => handleFieldChange("address.city", e)}
                  placeholder="City"
                  maxChar={100}
                  regex="letters"
                  sensitive
                />
              </FormGroup>
              <FormGroup>
                <CustomInputField
                  label="Barangay"
                  currentValue={
                    currentUserAccount?.metadata.address?.area ||
                    defaultAddress.area
                  }
                  onChange={(e) => handleFieldChange("address.area", e)}
                  placeholder="Barangay / Area"
                  maxChar={100}
                  sensitive
                />
              </FormGroup>
            </InputRow>

            <FormGroup>
              <CustomInputField
                label="Street"
                currentValue={
                  currentUserAccount?.metadata.address?.street ||
                  defaultAddress.street
                }
                onChange={(e) => handleFieldChange("address.street", e)}
                placeholder="Street address"
                maxChar={250}
                sensitive
              />
            </FormGroup>

            <InputRow>
              <FormGroup>
                <CustomInputField
                  label="Building / House No."
                  currentValue={
                    currentUserAccount?.metadata.address?.building ||
                    defaultAddress.building
                  }
                  onChange={(e) => handleFieldChange("address.building", e)}
                  placeholder="Building or house number"
                  maxChar={250}
                  sensitive
                />
              </FormGroup>
              <FormGroup>
                <CustomInputField
                  label="Postal / ZIP Code"
                  currentValue={
                    currentUserAccount?.metadata.address?.zip ||
                    defaultAddress.zip
                  }
                  onChange={(e) => handleFieldChange("address.zip", e)}
                  placeholder="ZIP code"
                  maxChar={8}
                  sensitive
                  regex="numbers"
                />
              </FormGroup>
            </InputRow>
          </PopUpFormButton>
        </HeaderActions>
      </PanelHeader>

      {/* ── Hero card ── */}
      <HeroCard>
        {/* Avatar + name + email + auth badge */}
        <HeroTop>
          <AvatarWrap>
            <Avatar $hue={avatarHue} data-private>
              {initials}
            </Avatar>
            <AuthDot />
          </AvatarWrap>

          <HeroMeta>
            <HeroName data-private>{displayName}</HeroName>
            <HeroEmail data-private>{originalUserAccount?.email}</HeroEmail>
            <AuthBadge>
              <BadgeDot />
              Authenticated
            </AuthBadge>
          </HeroMeta>
        </HeroTop>

        {/* Info strip — 4 key facts in a compact grid */}
        <InfoStrip>
          <InfoCell>
            <InfoLabel>Full Name</InfoLabel>
            <InfoValue data-private>
              {originalUserAccount?.fullName || "Not set"}
            </InfoValue>
          </InfoCell>

          <InfoCell>
            <InfoLabel>Gender</InfoLabel>
            <InfoValue data-private>
              {originalUserAccount?.gender || "Unspecified"}
            </InfoValue>
          </InfoCell>

          <InfoCell>
            <InfoLabel>Birthday</InfoLabel>
            <InfoValue data-private>{birthdayDisplay}</InfoValue>
          </InfoCell>

          <InfoCell>
            <InfoLabel>Address</InfoLabel>
            <InfoValue data-private>
              {originalUserAccount?.address || "Not set"}
            </InfoValue>
          </InfoCell>
        </InfoStrip>

        {/* Active Majik identity selector */}
        {/* <IdentityRow>
          <IdentityMeta>
            <IdentityLabel>Active Majik Identity</IdentityLabel>
          </IdentityMeta>
          <IdentitySelectorWrap>
            <MajikMessageIdentitySelector />
          </IdentitySelectorWrap>
        </IdentityRow> */}
      </HeroCard>
    </Root>
  );
};

export default DynamicUserProfile;
