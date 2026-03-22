# Diagrammes UML pour GestionTask

Voici le code PlantUML pour vos trois diagrammes. Vous pouvez copier-coller ces blocs directement sur [PlantText.com](https://www.planttext.com/) ou [PlantUML Web Server](https://plantuml.com/plantuml/) pour générer les images.

## 1. Diagramme des Cas d'Utilisation (Use Case Diagram)

```plantuml
@startuml
skinparam actorStyle hollow
left to right direction

actor "Utilisateur Authentifié" as User
actor "Administrateur / Créateur" as Admin
actor "Membre / Collaborateur" as Membre
actor "Système IA" as IA << System >>

Admin -up-|> User
Membre -up-|> User

package "GestionTask App" {
    
    usecase "Gérer son profil" as UC1
    usecase "Consulter statistiques / XP" as UC2
    usecase "Gérer contacts permanents" as UC3
    usecase "Créer une nouvelle tâche" as UC5

    usecase "Modifier détails tâche" as UC6
    usecase "Inviter/Retirer membres" as UC8
    usecase "Créer sous-tâches" as UC9
    usecase "Solliciter IA : Générer sous-tâches" as UC10
    usecase "Solliciter IA : Analyser santé" as UC11
    
    usecase "Répondre à une invitation" as UC12
    usecase "Consulter flux d'activité" as UC13
    usecase "Valider sous-tâche assignée" as UC14
    usecase "Ajouter des logs au journal" as UC15
    
    usecase "Générer découpage" as UC16
    usecase "Formuler diagnostic Scrum" as UC17
}

User --> UC1
User --> UC2
User --> UC3
User --> UC5

Admin --> UC6
Admin --> UC8
Admin --> UC9
Admin --> UC10
Admin --> UC11

Membre --> UC12
Membre --> UC13
Membre --> UC14
Membre --> UC15

IA --> UC16
IA --> UC17

UC10 ..> UC16 : <<include>>
UC11 ..> UC17 : <<include>>

note right of Admin
  Un utilisateur devient Administrateur 
  s'il crée la tâche ou possède les droits.
end note

note right of Membre
  Un utilisateur devient Membre
  lorsqu'il rejoint une tâche collective.
end note

@enduml
```

## 2. Diagramme de Classes (Class Diagram)

```plantuml
@startuml
skinparam classAttributeIconSize 0

class Profil {
    + id : UUID
    + nom : String
    + email : String
    + avatar_url : String
    + xp_points : Integer
    + niveau : Integer
    + modifierProfil()
}

class Tache {
    + id : UUID
    + titre : String
    + description : Text
    + date_debut : Date
    + date_echeance : Date
    + est_collectif : Boolean
    + est_important : Boolean
    + statut : String (en_cours, terminee, supprimee)
    + createur_id : UUID
    + calculerProgression()
    + archiver()
}

class SousTache {
    + id : UUID
    + tache_id : UUID
    + titre : String
    + statut : String
    + date_debut : Date
    + date_fin : Date
    + assigne_a : UUID
    + valider()
}

class MembreTache {
    + id : UUID
    + tache_id : UUID
    + utilisateur_id : UUID
    + role : String (admin, membre)
    + statut : String (accepte, en_attente)
    + modifierRole()
}

class LogTache {
    + id : UUID
    + tache_id : UUID
    + utilisateur_id : UUID
    + type : String (fait, prevu, probleme)
    + contenu : Text
    + cree_le : Timestamp
}

class FluxActivite {
    + id : UUID
    + tache_id : UUID
    + utilisateur_id : UUID
    + action : String
    + date : Timestamp
}

class ContactPermanent {
    + id : UUID
    + utilisateur_id : UUID
    + contact_id : UUID
    + nom_remplacement : String
}

Profil "1" -- "0..*" Tache : Créé par >
Tache "1" *-- "0..*" SousTache : Contient >
Tache "1" *-- "0..*" MembreTache : Possède >
Profil "1" -- "0..*" MembreTache : Participe à >
Tache "1" *-- "0..*" LogTache : Journalise >
Tache "1" *-- "0..*" FluxActivite : Génère >
Profil "1" -- "0..*" ContactPermanent : Ajoute >

@enduml
```

## 3. Diagramme de Séquence (Sequence Diagram) - Analyse IA

Ce diagramme illustre le flux lorsqu'un Administrateur clique sur "Analyse IA".

```plantuml
@startuml
actor "Administrateur" as Admin
participant "App Frontend\n(React)" as Front
participant "Supabase Backend\n(PostgreSQL)" as DB
participant "Edge Function\n(analyser-tache)" as Edge
participant "OpenAI/Gemini\n(API)" as IA

Admin -> Front : Clique sur "Analyse IA"
activate Front
Front -> DB : getSession() (Récupère JWT)
activate DB
DB --> Front : Renvoie Access Token
deactivate DB

Front -> Edge : invoke('analyser-tache', tacheId, JWT)
activate Edge
Edge -> DB : Vérifie droits (isAdmin?)
activate DB
DB --> Edge : Accès Autorisé
deactivate DB

Edge -> DB : Récupère Tâche, Sous-tâches, Logs
activate DB
DB --> Edge : Données complètes de la tâche
deactivate DB

Edge -> IA : Envoie contexte pour analyse Scrum
activate IA
IA --> Edge : Retourne JSON (resume, sante, risques)
deactivate IA

Edge --> Front : Réponse JSON (Analyse générée)
deactivate Edge

Front -> Front : Met à jour l'interface (setAiAnalysisText)
Front --> Admin : Affiche la modale d'Analyse IA
deactivate Front
@enduml
```
