targetScope = 'subscription'

@description('The approved region. Changing region requires a new user decision.')
@allowed(['westus3'])
param location string = 'westus3'

@description('Dedicated Confluence resource group; no shared resources are modified.')
param resourceGroupName string = 'rg-the-confluence-westus3'

@description('Preserve the user-selected brand in the secure generated hostname.')
@allowed(['the-confluence'])
param appName string = 'the-confluence'

resource group 'Microsoft.Resources/resourceGroups@2025-04-01' = {
  name: resourceGroupName
  location: location
  tags: {
    application: 'The Confluence'
    managedBy: 'Bicep'
  }
}

module hosting 'app-service.bicep' = {
  name: 'confluence-hosting'
  scope: group
  params: {
    location: location
    appName: appName
  }
}

output appUrl string = hosting.outputs.appUrl
output appName string = appName
output resourceGroupName string = group.name
output resourceGroupPortalUrl string = 'https://portal.azure.com/#resource${group.id}/overview'
