// Wrapper sobre Amplify Auth. Expone helpers: login/logout/isLoggedIn/tenantId.
//
// tenantId viene del custom attribute `custom:tenantId` del usuario Cognito.
// Lo seteamos manualmente al crear el user (admin via Cognito Console).
// Si falta o el user no está en el group correspondiente, todas las queries
// GraphQL rechazan por authorization (allow.groupDefinedIn('tenantId')).

import {
  signIn,
  signOut,
  getCurrentUser,
  fetchUserAttributes,
  type SignInInput,
} from "aws-amplify/auth";

export interface AuthSession {
  username: string;
  email: string;
  tenantId: string;
  groups: string[];
}

/**
 * Login con email + password. Throws si credenciales inválidas o usuario
 * requiere setNewPassword en primer login.
 *
 * El temp password de Cognito Console fuerza un cambio en primer login —
 * Amplify devuelve `NEW_PASSWORD_REQUIRED` que actualmente NO manejamos
 * (Fase 1 = solo login normal). Para primer login, usa Cognito Hosted UI
 * o cambia la password manualmente via Console antes.
 */
export async function login(email: string, password: string): Promise<void> {
  const input: SignInInput = { username: email, password };
  const result = await signIn(input);
  if (!result.isSignedIn) {
    throw new Error(
      `Login incompleto. Next step: ${result.nextStep.signInStep}. ` +
        `Si es NEW_PASSWORD_REQUIRED, cambia tu password en Cognito Console.`,
    );
  }
}

/** Cierra sesión y limpia JWT del local storage. */
export async function logout(): Promise<void> {
  await signOut();
}

/** True si hay sesión Cognito válida. No throws. */
export async function isLoggedIn(): Promise<boolean> {
  try {
    await getCurrentUser();
    return true;
  } catch {
    return false;
  }
}

/**
 * Devuelve datos de sesión actual o null si no hay login.
 * Lee custom:tenantId del JWT — si falta, error explícito porque queries
 * GraphQL no van a funcionar sin él.
 */
export async function getSession(): Promise<AuthSession | null> {
  try {
    const user = await getCurrentUser();
    const attrs = await fetchUserAttributes();
    const tenantId = attrs["custom:tenantId"];
    if (!tenantId) {
      throw new Error(
        "Usuario sin custom:tenantId. Configúralo en Cognito Console → User attributes.",
      );
    }
    // Groups vienen del JWT — no en fetchUserAttributes directamente. Sin embargo,
    // el client GraphQL usa el JWT raw (groups incluidos) para authorization rules.
    // Aquí los exponemos como array vacío (no críticos para el wire). Si necesitamos
    // verificar groups en cliente, leer JWT via fetchAuthSession().tokens.idToken.payload['cognito:groups'].
    return {
      username: user.username,
      email: attrs.email ?? "",
      tenantId,
      groups: [],
    };
  } catch {
    return null;
  }
}
